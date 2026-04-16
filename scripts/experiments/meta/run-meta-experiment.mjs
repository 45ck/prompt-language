#!/usr/bin/env node
// run-meta-experiment.mjs — single-entry harness for meta-factory runs.
//
// Usage:
//   node scripts/experiments/meta/run-meta-experiment.mjs <flow-path> [--live]
//
// Default is dry-run (parse + prerequisite check). --live invokes `claude -p`
// with full provenance trace capture under experiments/meta-factory/results/<run-id>/.

import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  copyFileSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { computeManifest } from './compute-manifest.mjs';
import { diffManifests } from './manifest-diff.mjs';
import { runPreflight as runBootstrapEnvelopePreflight } from './bootstrap-envelope.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..', '..');

const DEFAULT_WALL_CLOCK_SEC = Number(process.env.META_WALL_CLOCK_SEC ?? 25 * 60);
// Freshness window handed to verify-trace. 1 hour by default; override via
// META_FRESHNESS_WINDOW_MS for long-running live runs. Rationale: the trace's
// first entry must land within now() +/- window, so a replayed older trace
// (AP-5) cannot pass verification even if its nonce somehow agreed.
const DEFAULT_FRESHNESS_WINDOW_MS = Number(process.env.META_FRESHNESS_WINDOW_MS ?? 60 * 60 * 1000);
const BINARY_ALLOW_LIST_PATH = resolve(__dirname, '.binary-allow-list.json');

function log(...args) {
  console.error('[meta-harness]', ...args);
}

function outJson(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function which(binName) {
  const isWin = process.platform === 'win32';
  const exts = isWin ? ['.cmd', '.exe', '.bat', ''] : [''];
  const sep = isWin ? ';' : ':';
  const paths = (process.env.PATH ?? '').split(sep);
  for (const p of paths) {
    if (!p) continue;
    for (const ext of exts) {
      const full = join(p, binName + ext);
      try {
        if (statSync(full).isFile()) return full;
      } catch {
        /* continue */
      }
    }
  }
  return null;
}

function nowRunId() {
  // meta-<ms><ns-fraction>
  const hr = process.hrtime.bigint().toString();
  return `meta-${Date.now()}-${hr.slice(-6)}`;
}

function readFlow(flowPath) {
  const abs = isAbsolute(flowPath) ? flowPath : resolve(process.cwd(), flowPath);
  if (!existsSync(abs)) throw new Error(`flow path not found: ${abs}`);
  return { abs, text: readFileSync(abs, 'utf8') };
}

/** Resolve any `import: "<path>"` statements in the flow, returning list with existence. */
function scanImports(flowText, baseDir) {
  const results = [];
  const re = /^\s*import:\s*["']([^"']+)["']\s*$/gm;
  let m;
  while ((m = re.exec(flowText)) !== null) {
    const p = m[1];
    const abs = isAbsolute(p) ? p : resolve(baseDir, p);
    results.push({ spec: p, resolved: abs, exists: existsSync(abs) });
  }
  return results;
}

async function parseFlowText(flowText) {
  const parseFlowMod = await import(
    pathToFileURL(join(REPO_ROOT, 'dist', 'application', 'parse-flow.js')).href
  );
  const spec = parseFlowMod.parseFlow(flowText);
  return spec;
}

function checkCliInstalled() {
  // Plugin is installed when installed_plugins.json records a prompt-language entry.
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  const manifestPath = join(home, '.claude', 'plugins', 'installed_plugins.json');
  let installed = false;
  let installPath = null;
  try {
    const text = readFileSync(manifestPath, 'utf8');
    const parsed = JSON.parse(text);
    const plugins = parsed?.plugins ?? {};
    for (const [key, entries] of Object.entries(plugins)) {
      if (!key.startsWith('prompt-language')) continue;
      if (Array.isArray(entries) && entries.length > 0) {
        installed = true;
        installPath = entries[0]?.installPath ?? null;
        break;
      }
    }
  } catch {
    /* manifest missing or unparseable — installed stays false */
  }
  return { pluginDir: installPath, manifestPath, installed };
}

function ensureCliInstalled() {
  const st = checkCliInstalled();
  if (st.installed) return { ...st, ranInstall: false };
  log('plugin not installed; running bin/cli.mjs install');
  const r = spawnSync(process.execPath, [join(REPO_ROOT, 'bin', 'cli.mjs'), 'install'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  return { ...checkCliInstalled(), ranInstall: true, installExitCode: r.status ?? -1 };
}

function checkShim() {
  const shimDir = join(REPO_ROOT, 'scripts', 'eval', 'agent-shim');
  const ok = existsSync(shimDir);
  return { shimDir, exists: ok };
}

function checkClaudeAuth() {
  const claudeBin = which('claude');
  if (!claudeBin) return { claudeBin: null, authenticated: false, reason: 'claude-not-on-path' };
  const r = spawnSync(claudeBin, ['--version'], { encoding: 'utf8', timeout: 10_000 });
  if (r.status === 0) {
    return { claudeBin, authenticated: true, version: (r.stdout ?? '').trim() };
  }
  return {
    claudeBin,
    authenticated: false,
    reason: 'claude-version-failed',
    stderr: (r.stderr ?? '').slice(0, 500),
  };
}

function gitStash(label) {
  const r = spawnSync('git', ['stash', 'push', '-u', '-m', label], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const stashed = r.status === 0 && !(r.stdout ?? '').includes('No local changes to save');
  return { stashed, status: r.status ?? -1, stdout: (r.stdout ?? '').trim() };
}

function gitStashPop() {
  const r = spawnSync('git', ['stash', 'pop'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return {
    status: r.status ?? -1,
    stdout: (r.stdout ?? '').trim(),
    stderr: (r.stderr ?? '').trim(),
  };
}

async function runLive({ flowText, bundleDir, runId, wallClockSec, claudeBin }) {
  const traceDir = join(bundleDir, '.prompt-language');
  mkdirSync(traceDir, { recursive: true });
  const shimDir = join(REPO_ROOT, 'scripts', 'eval', 'agent-shim');
  const pathSep = process.platform === 'win32' ? ';' : ':';
  const env = {
    ...process.env,
    PL_TRACE: '1',
    PL_TRACE_STRICT: '1',
    PL_RUN_ID: runId,
    PL_TRACE_DIR: traceDir,
    PL_REAL_BIN_CLAUDE: claudeBin,
    PATH: shimDir + pathSep + (process.env.PATH ?? ''),
  };

  // We invoke claude directly (not via shim wrapper) — shim is on PATH in case flow needs it.
  const args = ['-p', '--dangerously-skip-permissions', flowText];
  log(`invoking claude (wall-clock cap ${wallClockSec}s)`);
  const child = spawn(claudeBin, args, {
    cwd: bundleDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  let timedOut = false;
  child.stdout.on('data', (d) => {
    stdout += d.toString();
  });
  child.stderr.on('data', (d) => {
    stderr += d.toString();
  });

  const timer = setTimeout(() => {
    timedOut = true;
    try {
      child.kill('SIGKILL');
    } catch {
      /* noop */
    }
  }, wallClockSec * 1000);

  const exit = await new Promise((res) => {
    child.on('exit', (code, signal) => res({ code, signal }));
  });
  clearTimeout(timer);

  writeFileSync(join(bundleDir, 'claude.stdout.log'), stdout);
  writeFileSync(join(bundleDir, 'claude.stderr.log'), stderr);

  return { exitCode: exit.code, signal: exit.signal, timedOut };
}

function copyIfExists(src, dst) {
  try {
    if (existsSync(src) && statSync(src).isFile()) {
      copyFileSync(src, dst);
      return true;
    }
  } catch {
    /* noop */
  }
  return false;
}

function persistJson(filePath, value) {
  writeFileSync(filePath, JSON.stringify(value, null, 2));
}

export function summarizeBootstrapPreflight(report) {
  const items = Array.isArray(report?.items) ? report.items : [];
  const blockedItems = items.filter((item) => item?.status === 'blocked');
  const warningItems = items.filter((item) => item?.status === 'warn');
  return {
    overall: report?.overall ?? 'unknown',
    blockedItems: blockedItems.map((item) => ({
      id: item.id ?? null,
      name: item.name ?? 'unknown',
      detail: item.detail ?? '',
    })),
    warningItems: warningItems.map((item) => ({
      id: item.id ?? null,
      name: item.name ?? 'unknown',
      detail: item.detail ?? '',
    })),
    nextActions: Array.isArray(report?.nextActions) ? report.nextActions : [],
  };
}

export function deriveClaimEligibility({
  bootstrapOverall,
  verifyOk,
  ruleWeakening,
  timedOut,
  errorStr,
  nonceMismatch,
}) {
  const blockers = [];
  if (bootstrapOverall === 'blocked') blockers.push('bootstrap-preflight-blocked');
  if (bootstrapOverall === 'degraded') blockers.push('bootstrap-preflight-degraded');
  if (nonceMismatch) blockers.push('run-nonce-mismatch');
  if (errorStr) blockers.push('harness-error');
  if (timedOut) blockers.push('wall-clock-timeout');
  if (ruleWeakening) blockers.push('rule-weakening-detected');
  if (verifyOk === false) blockers.push('verify-trace-failed');

  return {
    eligible: blockers.length === 0,
    status: blockers.length === 0 ? 'eligible' : 'ineligible',
    blockers,
  };
}

function runVerifyTrace(bundleDir, { expectedRunId, expectedPairCount, freshnessWindowMs }) {
  const verify = join(REPO_ROOT, 'scripts', 'eval', 'verify-trace.mjs');
  if (!existsSync(verify)) return { ran: false, reason: 'verify-trace.mjs-missing' };
  const trace = join(bundleDir, 'provenance.jsonl');
  const state = join(bundleDir, 'session-state.json');
  if (!existsSync(trace)) return { ran: false, reason: 'no-provenance' };

  // Per docs/security/witness-chain-attacks.md, the verifier needs at least
  // one input that originated outside the workspace a meta-flow can write.
  // We supply: an externally-generated nonce (expectedRunId), a freshness
  // window to reject replayed older traces, an expected-pair-count floor,
  // and, when populated on the host, a pinned binary allow-list.
  const args = [verify, '--trace', trace, '--json'];
  if (existsSync(state)) {
    args.push('--state', state);
  } else {
    // The meta-flow may legitimately finish without a session-state file.
    // Opt out explicitly so the OK line carries (state-check-skipped)
    // rather than silently passing.
    args.push('--allow-missing-state');
  }
  if (expectedRunId) args.push('--expected-run-id', expectedRunId);
  if (Number.isFinite(freshnessWindowMs) && freshnessWindowMs > 0) {
    args.push('--freshness-window-ms', String(freshnessWindowMs));
  }
  // TODO: tighten min-entries once the harness can introspect the flow
  // structure to derive an accurate agent-call count. For now, "at least 1"
  // catches the fully-empty-trace attack while not rejecting legitimate
  // runs that have not yet been instrumented end-to-end.
  args.push('--min-entries', '1');
  if (Number.isFinite(expectedPairCount) && expectedPairCount > 0) {
    args.push('--expected-pair-count', String(expectedPairCount));
  }
  if (existsSync(BINARY_ALLOW_LIST_PATH)) {
    args.push('--expected-binary-hashes', BINARY_ALLOW_LIST_PATH);
  }

  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  writeFileSync(join(bundleDir, 'verify.json'), r.stdout ?? '');
  return {
    ran: true,
    exitCode: r.status ?? -1,
    stderr: (r.stderr ?? '').slice(0, 1000),
    argsUsed: args.slice(1), // drop the verifier path prefix
  };
}

/**
 * Write a single-use nonce to a private per-user store outside the
 * meta-flow workspace. The store defaults to ~/.pl-meta-nonces but can be
 * overridden in tests via PL_META_NONCE_DIR. The harness uses the nonce as
 * PL_RUN_ID, then reads it back and passes it to verify-trace via
 * --expected-run-id so a replayed older trace (AP-5) fails verification.
 */
export function resolveNonceStoreDir() {
  const configured = process.env.PL_META_NONCE_DIR?.trim();
  const storeDir = configured ? resolve(configured) : join(homedir(), '.pl-meta-nonces');
  if (!storeDir) {
    throw new Error('unable to resolve nonce store dir; set PL_META_NONCE_DIR explicitly');
  }
  mkdirSync(storeDir, { recursive: true, mode: 0o700 });
  try {
    chmodSync(storeDir, 0o700);
  } catch {
    /* POSIX chmod may fail on Windows; permissions are advisory there */
  }
  return storeDir;
}

export function writeRunNonce() {
  const nonce = randomBytes(32).toString('hex');
  const noncePath = join(resolveNonceStoreDir(), `${randomBytes(32).toString('hex')}.nonce`);
  writeFileSync(noncePath, nonce, { encoding: 'utf8', mode: 0o400 });
  try {
    chmodSync(noncePath, 0o600);
  } catch {
    /* POSIX chmod may fail on Windows; permissions are advisory there */
  }
  return { nonce, noncePath };
}

export function readRunNonce(noncePath) {
  if (!existsSync(noncePath)) return null;
  return readFileSync(noncePath, 'utf8').trim();
}

export function deleteRunNonce(noncePath) {
  try {
    rmSync(noncePath, { force: true });
  } catch {
    /* noop */
  }
}

/**
 * Estimate a lower bound for the number of agent-call pairs the flow will
 * produce. Prompt and run nodes each produce (at most) one runtime/shim pair.
 * This is a heuristic — some nodes skip or auto-advance without emitting a
 * pair — so callers should treat a zero return as "omit --expected-pair-count"
 * rather than "expect zero pairs".
 *
 * TODO(security-hardening): tighten once the runtime exposes a deterministic
 * per-flow agent-call count.
 */
function estimatePairCount(flowSpec) {
  if (!flowSpec || !Array.isArray(flowSpec.nodes)) return 0;
  let n = 0;
  const walk = (nodes) => {
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      if (node.kind === 'prompt' || node.kind === 'run') n += 1;
      for (const k of Object.keys(node)) {
        const v = node[k];
        if (Array.isArray(v)) walk(v);
      }
    }
  };
  walk(flowSpec.nodes);
  return n;
}

async function dryRun({ flowAbs, flowText, runId }) {
  const baseDir = dirname(flowAbs);
  const imports = scanImports(flowText, baseDir);
  let parseOk = false;
  let parseError = null;
  let nodeCount = 0;
  try {
    const spec = await parseFlowText(flowText);
    parseOk = true;
    nodeCount = spec?.nodes?.length ?? 0;
  } catch (e) {
    parseError = (e && e.stack) || String(e);
  }
  const cli = checkCliInstalled();
  const shim = checkShim();
  const auth = checkClaudeAuth();
  const gitClean =
    spawnSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' }).stdout ?? '';
  const result = {
    mode: 'dry-run',
    runId,
    flow: flowAbs,
    parse: { ok: parseOk, nodeCount, error: parseError },
    imports,
    prerequisites: {
      pluginInstalled: cli.installed,
      pluginDir: cli.pluginDir,
      shimPresent: shim.exists,
      claudeAvailable: auth.claudeBin !== null,
      claudeVersion: auth.version ?? null,
      gitStashable: true, // always stashable; we note dirty tree
      gitDirtyFiles: gitClean.split('\n').filter(Boolean).length,
    },
    success:
      parseOk &&
      imports.every((i) => i.exists) &&
      cli.installed &&
      shim.exists &&
      auth.claudeBin !== null,
  };
  return result;
}

export async function liveRun(
  { flowText, runId, wallClockSec, bundleDirOverride = null },
  deps = {},
) {
  const bundleDir =
    bundleDirOverride ?? join(REPO_ROOT, 'experiments', 'meta-factory', 'results', runId);
  const ensureCliInstalledFn = deps.ensureCliInstalledFn ?? ensureCliInstalled;
  const checkShimFn = deps.checkShimFn ?? checkShim;
  const checkClaudeAuthFn = deps.checkClaudeAuthFn ?? checkClaudeAuth;
  const runBootstrapPreflightFn =
    deps.runBootstrapPreflightFn ?? ((options) => runBootstrapEnvelopePreflight(options));
  const runLiveFn = deps.runLiveFn ?? runLive;
  const parseFlowTextFn = deps.parseFlowTextFn ?? parseFlowText;
  const gitStashFn = deps.gitStashFn ?? gitStash;
  const gitStashPopFn = deps.gitStashPopFn ?? gitStashPop;
  const computeManifestFn = deps.computeManifestFn ?? computeManifest;
  const runVerifyTraceFn = deps.runVerifyTraceFn ?? runVerifyTrace;
  const diffManifestsFn = deps.diffManifestsFn ?? diffManifests;
  const writeRunNonceFn = deps.writeRunNonceFn ?? writeRunNonce;
  const readRunNonceFn = deps.readRunNonceFn ?? readRunNonce;
  const deleteRunNonceFn = deps.deleteRunNonceFn ?? deleteRunNonce;
  const bootstrapArtifactDir = join(bundleDir, 'bootstrap-envelope');

  const preflight = {};
  preflight.install = ensureCliInstalledFn();
  preflight.shim = checkShimFn();
  preflight.auth = checkClaudeAuthFn();
  mkdirSync(bundleDir, { recursive: true });
  preflight.bootstrapEnvelope = runBootstrapPreflightFn({
    repoRoot: REPO_ROOT,
    bundleDir: bootstrapArtifactDir,
    env: process.env,
  });
  persistJson(join(bundleDir, 'bootstrap-preflight.json'), preflight.bootstrapEnvelope);
  preflight.bootstrapEnvelopeSummary = summarizeBootstrapPreflight(preflight.bootstrapEnvelope);

  if (preflight.bootstrapEnvelope.overall === 'blocked') {
    const claimEligibility = deriveClaimEligibility({
      bootstrapOverall: preflight.bootstrapEnvelope.overall,
      verifyOk: null,
      ruleWeakening: false,
      timedOut: false,
      errorStr: null,
      nonceMismatch: false,
    });
    const summary = {
      mode: 'live',
      runId,
      bundleDir,
      success: false,
      reason: 'bootstrap-preflight-blocked',
      preflight,
      claimEligibility,
      launch: {
        attempted: false,
        blockedBy: preflight.bootstrapEnvelopeSummary.blockedItems,
      },
    };
    persistJson(join(bundleDir, 'report.json'), summary);
    return summary;
  }

  if (!preflight.auth.claudeBin) {
    const claimEligibility = deriveClaimEligibility({
      bootstrapOverall: preflight.bootstrapEnvelope.overall,
      verifyOk: null,
      ruleWeakening: false,
      timedOut: false,
      errorStr: 'claude-binary-not-found',
      nonceMismatch: false,
    });
    const summary = {
      mode: 'live',
      runId,
      bundleDir,
      success: false,
      reason: 'claude-binary-not-found',
      preflight,
      claimEligibility,
    };
    persistJson(join(bundleDir, 'report.json'), summary);
    return summary;
  }

  // AP-5: write the run nonce BEFORE launching claude. The nonce lives in
  // os.tmpdir() — explicitly outside the workspace the meta-flow can write
  // — and is the value we pass both to claude (as PL_RUN_ID) and to
  // verify-trace (as --expected-run-id). A meta-flow that tampers with
  // provenance.jsonl cannot rewrite the nonce file, so verify-trace will
  // reject any trace whose runId fails to equal the nonce.
  const { nonce: expectedRunId, noncePath } = writeRunNonceFn(runId);
  log(`wrote run nonce to ${noncePath}`);

  // Pre-estimate the expected pair count so verify-trace can reject a
  // truncated trace (AP-8). Heuristic only — see estimatePairCount().
  let expectedPairCount = 0;
  try {
    const spec = await parseFlowTextFn(flowText);
    expectedPairCount = estimatePairCount(spec);
  } catch {
    /* parse failures surface later; leave at 0 so the flag is omitted */
  }

  // Stash BEFORE creating the bundle dir so the stash does not sweep it up.
  const stashLabel = `meta-${runId}`;
  const stash = gitStashFn(stashLabel);

  let liveResult = null;
  let verify = null;
  let diff = null;
  let manifestPre = null;
  let manifestPost = null;
  let errorStr = null;
  let nonceMismatch = false;
  try {
    manifestPre = computeManifestFn(REPO_ROOT);
    persistJson(join(bundleDir, 'manifest-pre.json'), manifestPre);

    liveResult = await runLiveFn({
      flowText,
      bundleDir,
      runId: expectedRunId,
      wallClockSec,
      claudeBin: preflight.auth.claudeBin,
    });

    // Copy provenance + session state from working-directory .prompt-language dir
    const wdState = join(bundleDir, '.prompt-language');
    copyIfExists(join(wdState, 'provenance.jsonl'), join(bundleDir, 'provenance.jsonl'));
    copyIfExists(join(wdState, 'session-state.json'), join(bundleDir, 'session-state.json'));

    // Read the nonce back from the read-only tmpdir path. A mismatch here
    // would imply an attacker with cross-directory process privileges, which
    // is a substantially higher bar than workspace write access.
    const nonceOnDisk = readRunNonceFn(noncePath);
    if (!nonceOnDisk || nonceOnDisk !== expectedRunId) {
      nonceMismatch = true;
      errorStr = `run nonce at ${noncePath} did not round-trip (expected ${expectedRunId}, got ${nonceOnDisk ?? 'null'})`;
    }

    verify = runVerifyTraceFn(bundleDir, {
      expectedRunId,
      expectedPairCount,
      freshnessWindowMs: DEFAULT_FRESHNESS_WINDOW_MS,
    });

    manifestPost = computeManifestFn(REPO_ROOT);
    persistJson(join(bundleDir, 'manifest-post.json'), manifestPost);
    diff = diffManifestsFn(manifestPre, manifestPost);
    persistJson(join(bundleDir, 'diff.json'), diff);
  } catch (e) {
    errorStr = (e && e.stack) || String(e);
  } finally {
    // Delete the nonce file after verification completes so a subsequent
    // run cannot accidentally inherit it.
    deleteRunNonceFn(noncePath);
    if (stash.stashed) {
      const pop = gitStashPopFn();
      persistJson(join(bundleDir, 'stash-pop.json'), { stash, pop });
    }
  }

  const verifyOk = verify?.ran && verify.exitCode === 0;
  const ruleWeakening = (diff?.protectedChanged ?? []).length > 0;
  const success = Boolean(verifyOk) && !ruleWeakening && !liveResult?.timedOut && !errorStr;
  const claimEligibility = deriveClaimEligibility({
    bootstrapOverall: preflight.bootstrapEnvelope.overall,
    verifyOk,
    ruleWeakening,
    timedOut: liveResult?.timedOut ?? false,
    errorStr,
    nonceMismatch,
  });

  const summary = {
    mode: 'live',
    runId,
    expectedRunId,
    noncePath,
    expectedPairCount,
    freshnessWindowMs: DEFAULT_FRESHNESS_WINDOW_MS,
    binaryAllowList: existsSync(BINARY_ALLOW_LIST_PATH) ? BINARY_ALLOW_LIST_PATH : null,
    bundleDir,
    success,
    claimEligibility,
    reason: nonceMismatch
      ? 'run-nonce-mismatch'
      : errorStr
        ? 'harness-error'
        : liveResult?.timedOut
          ? 'wall-clock-timeout'
          : ruleWeakening
            ? 'rule-weakening-detected'
            : !verifyOk
              ? 'verify-trace-failed'
              : 'ok',
    preflight,
    live: liveResult,
    verify,
    diff,
    error: errorStr,
  };
  persistJson(join(bundleDir, 'report.json'), summary);
  return summary;
}

export async function main(argv = process.argv.slice(2)) {
  const args = argv.filter((a) => !a.startsWith('--'));
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  if (args.length < 1) {
    log('usage: run-meta-experiment.mjs <flow-path> [--live]');
    process.exit(2);
  }
  const flowPath = args[0];
  const live = flags.has('--live');
  const runId = nowRunId();
  const wallClockSec = DEFAULT_WALL_CLOCK_SEC;

  const { abs, text } = readFlow(flowPath);
  const result = live
    ? await liveRun({ flowText: text, runId, wallClockSec })
    : await dryRun({ flowAbs: abs, flowText: text, runId });

  outJson({
    mode: result.mode,
    runId: result.runId,
    success: result.success,
    reason: result.reason ?? null,
    bundleDir: result.bundleDir ?? null,
  });
  return result;
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMain) {
  main().then(
    (r) => {
      process.exit(r.success ? 0 : 1);
    },
    (e) => {
      log('fatal', e?.stack ?? e);
      process.exit(2);
    },
  );
}

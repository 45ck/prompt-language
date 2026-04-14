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
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  statSync,
} from 'node:fs';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { computeManifest } from './compute-manifest.mjs';
import { diffManifests } from './manifest-diff.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..', '..');

const DEFAULT_WALL_CLOCK_SEC = Number(process.env.META_WALL_CLOCK_SEC ?? 25 * 60);

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

function runVerifyTrace(bundleDir) {
  const verify = join(REPO_ROOT, 'scripts', 'eval', 'verify-trace.mjs');
  if (!existsSync(verify)) return { ran: false, reason: 'verify-trace.mjs-missing' };
  const trace = join(bundleDir, 'provenance.jsonl');
  const state = join(bundleDir, 'session-state.json');
  if (!existsSync(trace)) return { ran: false, reason: 'no-provenance' };
  const r = spawnSync(process.execPath, [verify, '--trace', trace, '--state', state, '--json'], {
    encoding: 'utf8',
  });
  writeFileSync(join(bundleDir, 'verify.json'), r.stdout ?? '');
  return { ran: true, exitCode: r.status ?? -1, stderr: (r.stderr ?? '').slice(0, 1000) };
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

async function liveRun({ flowText, runId, wallClockSec }) {
  const bundleDir = join(REPO_ROOT, 'experiments', 'meta-factory', 'results', runId);

  const preflight = {};
  preflight.install = ensureCliInstalled();
  preflight.shim = checkShim();
  preflight.auth = checkClaudeAuth();

  if (!preflight.auth.claudeBin) {
    mkdirSync(bundleDir, { recursive: true });
    const summary = {
      mode: 'live',
      runId,
      bundleDir,
      success: false,
      reason: 'claude-binary-not-found',
      preflight,
    };
    writeFileSync(join(bundleDir, 'report.json'), JSON.stringify(summary, null, 2));
    return summary;
  }

  // Stash BEFORE creating the bundle dir so the stash does not sweep it up.
  const stashLabel = `meta-${runId}`;
  const stash = gitStash(stashLabel);
  mkdirSync(bundleDir, { recursive: true });

  let liveResult = null;
  let verify = null;
  let diff = null;
  let manifestPre = null;
  let manifestPost = null;
  let errorStr = null;
  try {
    manifestPre = computeManifest(REPO_ROOT);
    writeFileSync(join(bundleDir, 'manifest-pre.json'), JSON.stringify(manifestPre, null, 2));

    liveResult = await runLive({
      flowText,
      bundleDir,
      runId,
      wallClockSec,
      claudeBin: preflight.auth.claudeBin,
    });

    // Copy provenance + session state from working-directory .prompt-language dir
    const wdState = join(bundleDir, '.prompt-language');
    copyIfExists(join(wdState, 'provenance.jsonl'), join(bundleDir, 'provenance.jsonl'));
    copyIfExists(join(wdState, 'session-state.json'), join(bundleDir, 'session-state.json'));

    verify = runVerifyTrace(bundleDir);

    manifestPost = computeManifest(REPO_ROOT);
    writeFileSync(join(bundleDir, 'manifest-post.json'), JSON.stringify(manifestPost, null, 2));
    diff = diffManifests(manifestPre, manifestPost);
    writeFileSync(join(bundleDir, 'diff.json'), JSON.stringify(diff, null, 2));
  } catch (e) {
    errorStr = (e && e.stack) || String(e);
  } finally {
    if (stash.stashed) {
      const pop = gitStashPop();
      writeFileSync(join(bundleDir, 'stash-pop.json'), JSON.stringify({ stash, pop }, null, 2));
    }
  }

  const verifyOk = verify?.ran && verify.exitCode === 0;
  const ruleWeakening = (diff?.protectedChanged ?? []).length > 0;
  const success = Boolean(verifyOk) && !ruleWeakening && !liveResult?.timedOut && !errorStr;

  const summary = {
    mode: 'live',
    runId,
    bundleDir,
    success,
    reason: errorStr
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
  writeFileSync(join(bundleDir, 'report.json'), JSON.stringify(summary, null, 2));
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

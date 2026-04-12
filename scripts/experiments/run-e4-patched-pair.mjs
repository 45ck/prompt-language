#!/usr/bin/env node

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = join(ROOT, 'bin', 'cli.mjs');
const FACTORY_ROOT = join(ROOT, 'experiments', 'full-saas-factory', 'e4-codex-crm-factory');
const BOOTSTRAP_ROOT = join(FACTORY_ROOT, 'bootstrap');
const CONTROL_ROOT = join(FACTORY_ROOT, 'control');
const WORKSPACES_ROOT = join(FACTORY_ROOT, 'workspaces', 'runs');
const RESULTS_ROOT = join(ROOT, 'experiments', 'results', 'e4-factory');
const RUNS_ROOT = join(RESULTS_ROOT, 'runs');
const INCOMPLETE_RUNS_ROOT = join(RESULTS_ROOT, 'incomplete');
const INCOMPLETE_WORKSPACES_ROOT = join(FACTORY_ROOT, 'workspaces', 'incomplete');
const COMPARISON_PATH = join(RESULTS_ROOT, 'comparison.md');
const ANALYSIS_PATH = join(RESULTS_ROOT, 'analysis-2026-04-12.md');

const SEED_ROOT = join(BOOTSTRAP_ROOT, 'core-proof-seed');
const PL_OVERLAY_ROOT = join(BOOTSTRAP_ROOT, 'pl-overlay');
const THROUGHPUT_CONTROL_FILE = join(CONTROL_ROOT, 'core-proof-throughput.flow');
const S2_PRE_VERIFICATION_CONTROL_FILE = join(CONTROL_ROOT, 'core-proof-s2-pre-verification.flow');
const PROMPT_FILE = join(CONTROL_ROOT, 'codex-alone-core-proof.prompt.md');
const S2_PRE_VERIFICATION_PROMPT_FILE = join(
  CONTROL_ROOT,
  'codex-alone-s2-pre-verification.prompt.md',
);

const COMMON_REQUIRED_ARTIFACTS = [
  'docs/prd.md',
  'docs/acceptance-criteria.md',
  'docs/architecture/domain-model.md',
  'docs/api-contracts.md',
  'specs/invariants.md',
  'packages/domain/src/index.ts',
  'packages/api/src/index.ts',
  'README.md',
  'docs/handover.md',
  'docs/test-strategy.md',
];

const LANE_SPECIFIC_REQUIRED_ARTIFACTS = {
  'pl-sequential': ['.factory/project.flow'],
  'codex-alone': [],
};

const VERIFICATION_COMMANDS = ['npm run lint', 'npm run typecheck', 'npm run test'];
const DEFAULT_MODEL = 'gpt-5.2';
const DEFAULT_ORDER = 'codex-first';
const DEFAULT_SCENARIO = 's0-clean';
const LANE_TIMEOUT_MS = 45 * 60 * 1000;
const PREFLIGHT_TIMEOUT_MS = 2 * 60 * 1000;
const PREPARE_TIMEOUT_MS = 10 * 60 * 1000;
const VERIFICATION_TIMEOUT_MS = 3 * 60 * 1000;

const GIT_BIN = process.platform === 'win32' ? 'git.exe' : 'git';
const CHECKPOINT_POLL_INTERVAL_MS = 250;

const SCENARIO_CONFIGS = {
  's0-clean': {
    kind: 'throughput',
    controlFile: THROUGHPUT_CONTROL_FILE,
    promptFile: PROMPT_FILE,
    timingEnvelope: 'paired-throughput-s0-external-verification',
    question:
      'For the same bounded CRM core slice and frozen bootstrap seed, how does prompt-language compare with direct Codex?',
  },
  's2-pre-verification': {
    kind: 'recovery',
    controlFile: S2_PRE_VERIFICATION_CONTROL_FILE,
    promptFile: S2_PRE_VERIFICATION_PROMPT_FILE,
    timingEnvelope: 'paired-recovery-s2-pre-verification',
    interruptStage: 'pre-verification',
    interruptCheckpoint: '.factory/checkpoints/pre-verification-ready',
    question:
      'After a forced pre-verification stop on the same bounded CRM core slice, which lane resumes and closes more effectively from the preserved workspace state?',
  },
};

function parseArgs(argv) {
  const options = {
    model: DEFAULT_MODEL,
    order: DEFAULT_ORDER,
    runId: null,
    scenario: DEFAULT_SCENARIO,
    attemptLabel: null,
    batchId: null,
    pairId: null,
    documentedHumanInterventions: 0,
    plRestartCount: 0,
    codexRestartCount: 0,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === '--model' && next !== undefined) {
      options.model = next;
      index += 1;
      continue;
    }
    if (current === '--order' && next !== undefined) {
      options.order = next;
      index += 1;
      continue;
    }
    if (current === '--run-id' && next !== undefined) {
      options.runId = next;
      index += 1;
      continue;
    }
    if (current === '--attempt-label' && next !== undefined) {
      options.attemptLabel = next;
      index += 1;
      continue;
    }
    if (current === '--batch-id' && next !== undefined) {
      options.batchId = next;
      index += 1;
      continue;
    }
    if (current === '--pair-id' && next !== undefined) {
      options.pairId = next;
      index += 1;
      continue;
    }
    if (current === '--scenario' && next !== undefined) {
      options.scenario = next;
      index += 1;
      continue;
    }
    if (current === '--documented-human-interventions' && next !== undefined) {
      options.documentedHumanInterventions = parseNonNegativeInteger(
        next,
        '--documented-human-interventions',
      );
      index += 1;
      continue;
    }
    if (current === '--pl-restart-count' && next !== undefined) {
      options.plRestartCount = parseNonNegativeInteger(next, '--pl-restart-count');
      index += 1;
      continue;
    }
    if (current === '--codex-restart-count' && next !== undefined) {
      options.codexRestartCount = parseNonNegativeInteger(next, '--codex-restart-count');
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument "${current}"`);
  }

  if (!['codex-first', 'pl-first'].includes(options.order)) {
    throw new Error(`--order must be codex-first or pl-first, received "${options.order}"`);
  }

  if (!Object.hasOwn(SCENARIO_CONFIGS, options.scenario)) {
    throw new Error(
      `--scenario must be one of ${Object.keys(SCENARIO_CONFIGS).join(', ')}, received "${options.scenario}"`,
    );
  }

  return options;
}

function scenarioConfigFor(scenario) {
  const config = SCENARIO_CONFIGS[scenario];
  if (config === undefined) {
    throw new Error(`Unknown scenario "${scenario}"`);
  }
  return config;
}

function parseNonNegativeInteger(value, flagName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flagName} must be a non-negative integer, received "${value}"`);
  }
  return parsed;
}

function nowIso() {
  return new Date().toISOString();
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatRunTimestamp(date) {
  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('') +
    '-' +
    [pad(date.getHours()), pad(date.getMinutes())].join('')
  );
}

async function listDirectoryNames(path) {
  if (!existsSync(path)) {
    return [];
  }
  const entries = await readdir(path, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

async function nextAttemptNumber() {
  const names = [
    ...(await listDirectoryNames(RUNS_ROOT)),
    ...(await listDirectoryNames(RESULTS_ROOT)),
  ];

  let highest = 1;
  for (const name of names) {
    const match = /(?:^|[-_])a(\d{2})(?:[-_]|$)/i.exec(name) ?? /^A(\d{2})/i.exec(name);
    if (!match) {
      continue;
    }
    const value = Number.parseInt(match[1], 10);
    if (Number.isFinite(value)) {
      highest = Math.max(highest, value);
    }
  }

  return highest + 1;
}

function repoRelative(path) {
  return relative(ROOT, path).replaceAll('\\', '/');
}

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function writeText(path, content) {
  await ensureDir(dirname(path));
  await writeFile(path, content, 'utf8');
}

async function writeJson(path, value) {
  await writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function moveIfExists(source, target) {
  if (!existsSync(source)) {
    return;
  }
  await ensureDir(dirname(target));
  await rm(target, { recursive: true, force: true });
  await rename(source, target);
}

function safeText(value, fallback) {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return fallback;
}

function quotePowerShellArg(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildCodexPowerShellCommand(args) {
  return `& codex ${args.map(quotePowerShellArg).join(' ')}`;
}

function resolveWindowsCodexCommandPrefix() {
  try {
    const result = spawnSync('where.exe', ['codex.cmd'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    const shimPath = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (result.status === 0 && shimPath) {
      const shimDir = dirname(shimPath);
      const bundledNode = join(shimDir, 'node.exe');
      const entrypoint = join(shimDir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
      if (existsSync(entrypoint)) {
        return [existsSync(bundledNode) ? bundledNode : 'node', [entrypoint]];
      }
    }
  } catch {
    // Fall back to PowerShell.
  }

  return ['powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command']];
}

function codexBinaryCommand(...args) {
  if (process.platform !== 'win32') {
    return ['codex', ...args];
  }

  const [command, prefixArgs] = resolveWindowsCodexCommandPrefix();
  if (command === 'powershell') {
    return [command, ...prefixArgs, buildCodexPowerShellCommand(args)];
  }
  return [command, ...prefixArgs, ...args];
}

function npmBinaryCommand(...args) {
  if (process.platform === 'win32') {
    return ['cmd.exe', '/d', '/s', '/c', 'npm', ...args];
  }
  return ['npm', ...args];
}

function runProcess(command, args, { cwd, input, timeoutMs, env } = {}) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd,
    input,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      ...env,
    },
    windowsHide: true,
  });
  const endedAt = Date.now();
  const timedOut = result.error?.name === 'Error' && result.error?.message.includes('ETIMEDOUT');
  const exitCode = result.status ?? (timedOut ? 124 : 1);

  return {
    command,
    args,
    cwd,
    exitCode,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    durationMs: Math.max(0, endedAt - startedAt),
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    timedOut,
    error: result.error?.message ?? null,
  };
}

async function killProcessTree(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return;
  }

  if (process.platform === 'win32') {
    await new Promise((resolvePromise) => {
      const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.once('error', () => resolvePromise());
      killer.once('exit', () => resolvePromise());
    });
    return;
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // Ignore already-exited children.
  }
}

async function runProcessWithCheckpointInterruption(
  command,
  args,
  { cwd, input, timeoutMs, env, checkpointPath } = {},
) {
  const startedAt = Date.now();
  const child = spawn(command, args, {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let stdout = '';
  let stderr = '';
  let interruptRequested = false;
  let interrupted = false;
  let timedOut = false;
  let interruptDetectedAtMs = null;
  let errorMessage = null;

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  if (typeof input === 'string' && child.stdin.writable) {
    child.stdin.write(input);
  }
  if (child.stdin.writable) {
    child.stdin.end();
  }

  const requestInterrupt = async (reason) => {
    if (interruptRequested) {
      return;
    }
    interruptRequested = true;
    if (reason === 'checkpoint') {
      interrupted = true;
      interruptDetectedAtMs = Date.now();
    }
    if (reason === 'timeout') {
      timedOut = true;
    }
    await killProcessTree(child.pid ?? -1);
  };

  const timeoutHandle =
    timeoutMs === undefined
      ? null
      : setTimeout(() => {
          void requestInterrupt('timeout');
        }, timeoutMs);
  const checkpointHandle =
    checkpointPath === undefined
      ? null
      : setInterval(() => {
          if (!interruptRequested && existsSync(checkpointPath)) {
            void requestInterrupt('checkpoint');
          }
        }, CHECKPOINT_POLL_INTERVAL_MS);

  const exitCode = await new Promise((resolvePromise) => {
    child.once('error', (error) => {
      errorMessage = error.message;
    });
    child.once('close', (code) => {
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
      if (checkpointHandle !== null) {
        clearInterval(checkpointHandle);
      }
      resolvePromise(code ?? (timedOut ? 124 : interrupted ? 130 : 1));
    });
  });

  const endedAt = Date.now();
  return {
    command,
    args,
    cwd,
    exitCode,
    stdout,
    stderr,
    durationMs: Math.max(0, endedAt - startedAt),
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    timedOut,
    interrupted,
    interruptDetectedAt:
      interruptDetectedAtMs === null ? null : new Date(interruptDetectedAtMs).toISOString(),
    checkpointPath,
    error: errorMessage,
  };
}

async function readText(path) {
  return await readFile(path, 'utf8');
}

async function listFilesRecursively(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const results = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = join(current, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await listFilesRecursively(root, absolute)));
      continue;
    }
    results.push(relative(root, absolute).replaceAll('\\', '/'));
  }

  return results;
}

async function computeDirectoryHash(root) {
  const hash = createHash('sha256');
  hash.update('dir\n');
  const files = await listFilesRecursively(root);
  for (const file of files) {
    hash.update(file);
    hash.update('\n');
    hash.update(await readFile(join(root, file)));
    hash.update('\n');
  }
  return hash.digest('hex');
}

async function computeFileHash(path) {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

function promptFileForScenario(scenario) {
  return scenarioConfigFor(scenario).promptFile;
}

function readGitHead() {
  return execFileSync(GIT_BIN, ['rev-parse', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 20_000,
    windowsHide: true,
  }).trim();
}

function readGitStatusShort() {
  return execFileSync(GIT_BIN, ['status', '--short'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 20_000,
    windowsHide: true,
  }).trim();
}

function readVersion(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 20_000,
      windowsHide: true,
    }).trim();
  } catch (error) {
    return `unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function readCodexVersion() {
  const [command, ...args] = codexBinaryCommand('--version');
  return readVersion(command, args);
}

function readNpmVersion() {
  const [command, ...args] = npmBinaryCommand('--version');
  return readVersion(command, args);
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function scoreProductOutcome(artifactsComplete, verificationPassCount) {
  if (artifactsComplete && verificationPassCount === 3) {
    return { scopeCompletion: 2, verification: 2, artifactCompleteness: 2 };
  }

  return {
    scopeCompletion: artifactsComplete ? 1 : 0,
    verification: verificationPassCount >= 2 ? 1 : verificationPassCount >= 1 ? 1 : 0,
    artifactCompleteness: artifactsComplete ? 2 : verificationPassCount >= 1 ? 1 : 0,
  };
}

function scoreSetupSimplicity(runtimeFailureCount, restartCount, interventionCount) {
  if (runtimeFailureCount === 0 && restartCount === 0 && interventionCount === 0) {
    return 2;
  }
  if (runtimeFailureCount <= 1 && restartCount <= 1 && interventionCount === 0) {
    return 1;
  }
  return 0;
}

function scoreAuditability(traceCompleteness) {
  return traceCompleteness === 'strong' ? 2 : traceCompleteness === 'mixed' ? 1 : 0;
}

function scoreExperimentalControl(
  paired,
  throughputMetricsComplete,
  traceCompleteness,
  admissibility,
) {
  if (
    paired &&
    throughputMetricsComplete &&
    traceCompleteness === 'strong' &&
    admissibility.throughputClaimEligible
  ) {
    return 2;
  }
  if (paired) {
    return 1;
  }
  return 0;
}

function scoreAutomationIntegrity(runtimeFailureCount, restartCount, interventionCount) {
  if (runtimeFailureCount === 0 && restartCount === 0 && interventionCount === 0) {
    return 2;
  }
  if (interventionCount === 0) {
    return 1;
  }
  return 0;
}

function scoreRepeatabilityEvidence(admissibility) {
  if (admissibility.throughputClaimEligible) {
    return 2;
  }
  return 0;
}

function totalVerificationPasses(verification) {
  return Object.values(verification).filter((value) => value === 'pass').length;
}

async function snapshotWorkspaceFiles(root) {
  const snapshot = new Map();
  if (!existsSync(root)) {
    return snapshot;
  }

  const files = await listFilesRecursively(root);
  for (const file of files) {
    if (file.startsWith('node_modules/')) {
      continue;
    }
    const absolute = join(root, file);
    const fileStat = await stat(absolute);
    snapshot.set(file, fileStat.mtimeMs);
  }
  return snapshot;
}

async function detectFirstRelevantWrite(root, initialSnapshot, startedAtMs) {
  const files = await listFilesRecursively(root);
  let firstChangedAt = Number.POSITIVE_INFINITY;

  for (const file of files) {
    if (file.startsWith('node_modules/')) {
      continue;
    }
    const absolute = join(root, file);
    const fileStat = await stat(absolute);
    const previous = initialSnapshot.get(file);
    const isNewFile = previous === undefined;
    const changed = isNewFile || fileStat.mtimeMs > previous + 1;
    if (!changed || fileStat.mtimeMs < startedAtMs) {
      continue;
    }
    firstChangedAt = Math.min(firstChangedAt, fileStat.mtimeMs);
  }

  if (!Number.isFinite(firstChangedAt)) {
    return null;
  }

  return roundSeconds((firstChangedAt - startedAtMs) / 1000);
}

function requiredArtifactsForLane(lane) {
  return [...COMMON_REQUIRED_ARTIFACTS, ...(LANE_SPECIFIC_REQUIRED_ARTIFACTS[lane] ?? [])];
}

async function existingRequiredArtifacts(workspaceRoot, requiredArtifacts) {
  const present = [];
  const missing = [];
  for (const artifact of requiredArtifacts) {
    const absolute = join(workspaceRoot, artifact);
    if (existsSync(absolute)) {
      present.push(artifact);
    } else {
      missing.push(artifact);
    }
  }
  return {
    present,
    missing,
    complete: missing.length === 0,
  };
}

function roundSeconds(value) {
  return Math.round(value * 100) / 100;
}

async function captureSystemSnapshot() {
  const snapshot = {
    timestamp: nowIso(),
    platform: process.platform,
    totalMemoryBytes: null,
    freeMemoryBytes: null,
    cpuLoadPercent: null,
    codexProcesses: [],
    ollamaProcesses: [],
    error: null,
  };

  if (process.platform !== 'win32') {
    return snapshot;
  }

  const command = [
    '$cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average',
    '$mem = Get-CimInstance Win32_OperatingSystem',
    '$total = [int64]((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory)',
    '$free = [int64]($mem.FreePhysicalMemory * 1kb)',
    '$codex = @(Get-Process codex -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, WS, CPU)',
    '$ollama = @(Get-Process ollama -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, WS, CPU)',
    '[pscustomobject]@{',
    '  timestamp = (Get-Date).ToString("o")',
    '  totalMemoryBytes = $total',
    '  freeMemoryBytes = $free',
    '  cpuLoadPercent = $cpu',
    '  codexProcesses = $codex',
    '  ollamaProcesses = $ollama',
    '} | ConvertTo-Json -Depth 5 -Compress',
  ].join('\n');

  const result = runProcess(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    {
      cwd: ROOT,
      timeoutMs: 20_000,
    },
  );

  if (result.exitCode !== 0) {
    snapshot.error = safeText(result.stderr, result.error ?? 'snapshot collection failed');
    return snapshot;
  }

  const parsed = parseJson(result.stdout.trim());
  if (parsed === null) {
    snapshot.error = 'snapshot output was not valid JSON';
    return snapshot;
  }

  return parsed;
}

function formatCommandLog(label, result) {
  return [
    `command: ${label}`,
    `startedAt: ${result.startedAt}`,
    `endedAt: ${result.endedAt}`,
    `durationMs: ${result.durationMs}`,
    `exitCode: ${result.exitCode}`,
    `timedOut: ${result.timedOut}`,
    result.error ? `error: ${result.error}` : null,
    '',
    'stdout:',
    safeText(result.stdout, '(no stdout)'),
    '',
    'stderr:',
    safeText(result.stderr, '(no stderr)'),
    '',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function verificationState(result) {
  return result.exitCode === 0 ? 'pass' : 'fail';
}

async function runVerificationCommand(scriptName, workspaceRoot, resultsRoot) {
  const [command, ...args] = npmBinaryCommand('run', scriptName);
  const result = runProcess(command, args, {
    cwd: workspaceRoot,
    timeoutMs: VERIFICATION_TIMEOUT_MS,
  });
  await writeText(
    join(resultsRoot, `${scriptName}.log`),
    formatCommandLog(`npm run ${scriptName}`, result),
  );
  return result;
}

function determineLaneClosure({ artifactsComplete, verification, anyArtifactsPresent }) {
  const passCount = totalVerificationPasses(verification);
  if (artifactsComplete && passCount === 3) {
    return { status: 'completed', verdict: 'success' };
  }
  if (anyArtifactsPresent || passCount > 0) {
    return { status: 'partial', verdict: 'partial' };
  }
  return { status: 'failure', verdict: 'failure' };
}

function traceCompletenessFor(paths) {
  let present = 0;
  for (const path of paths) {
    if (existsSync(path)) {
      present += 1;
    }
  }
  if (present === paths.length) {
    return 'strong';
  }
  if (present > 0) {
    return 'mixed';
  }
  return 'weak';
}

function determineFailureClass({
  runtimeFailureCount,
  blockedPreflight,
  mainStatus,
  traceCompleteness,
}) {
  if (blockedPreflight) {
    return 'config';
  }
  if (traceCompleteness === 'weak') {
    return 'evidence';
  }
  if (runtimeFailureCount > 0 || mainStatus === 'failed') {
    return 'runtime';
  }
  if (mainStatus === 'blocked') {
    return 'config';
  }
  if (mainStatus === 'unsuccessful') {
    return 'product';
  }
  return 'none';
}

function buildBootstrapInfo(seedHash, overlayHash) {
  return {
    seedPath: repoRelative(SEED_ROOT),
    seedHash,
    overlayPath: repoRelative(PL_OVERLAY_ROOT),
    overlayHash,
  };
}

async function prepareSeed(runRoot, bootstrapInfo) {
  const tempSeedRoot = await mkdtemp(join(tmpdir(), 'e4-pair-seed-'));
  await cp(SEED_ROOT, tempSeedRoot, { recursive: true, preserveTimestamps: true });

  const [command, ...args] = npmBinaryCommand('ci');
  const installResult = runProcess(command, args, {
    cwd: tempSeedRoot,
    timeoutMs: PREPARE_TIMEOUT_MS,
  });
  await writeText(
    join(runRoot, 'bootstrap', 'npm-ci.log'),
    formatCommandLog('npm ci', installResult),
  );
  await writeJson(join(runRoot, 'bootstrap', 'seed.json'), bootstrapInfo);

  if (installResult.exitCode !== 0) {
    throw new Error('Bootstrap seed installation failed');
  }

  return tempSeedRoot;
}

async function materializeLaneWorkspace(preparedSeedRoot, targetWorkspaceRoot, overlayRoot = null) {
  await rm(targetWorkspaceRoot, { recursive: true, force: true });
  await ensureDir(dirname(targetWorkspaceRoot));
  await cp(preparedSeedRoot, targetWorkspaceRoot, { recursive: true, preserveTimestamps: true });
  if (overlayRoot !== null) {
    await cp(overlayRoot, targetWorkspaceRoot, { recursive: true, preserveTimestamps: true });
  }
}

async function copyFileIfExists(source, target) {
  if (!existsSync(source)) {
    return;
  }
  await ensureDir(dirname(target));
  await cp(source, target, { force: true });
}

async function writePromptLanguageAttemptArtifacts({
  attemptRoot,
  preflight,
  mainRun,
  stateDir,
  checkpointPath,
}) {
  await ensureDir(attemptRoot);
  if (preflight !== null) {
    await writeText(join(attemptRoot, 'preflight.json'), safeText(preflight.stdout, '{}\n'));
    await writeText(
      join(attemptRoot, 'preflight-stderr.log'),
      safeText(preflight.stderr, '(no stderr)\n'),
    );
  }
  if (mainRun !== null) {
    await writeText(join(attemptRoot, 'run-report.json'), safeText(mainRun.stdout, '{}\n'));
    await writeText(join(attemptRoot, 'run-stderr.log'), safeText(mainRun.stderr, '(no stderr)\n'));
    await writeJson(join(attemptRoot, 'run-metadata.json'), {
      exitCode: mainRun.exitCode,
      timedOut: mainRun.timedOut,
      interrupted: mainRun.interrupted ?? false,
      interruptDetectedAt: mainRun.interruptDetectedAt ?? null,
      startedAt: mainRun.startedAt,
      endedAt: mainRun.endedAt,
      checkpointPath: checkpointPath === undefined ? null : repoRelative(checkpointPath),
    });
  }
  await copyFileIfExists(
    join(stateDir, 'session-state.json'),
    join(attemptRoot, 'session-state.json'),
  );
  await copyFileIfExists(join(stateDir, 'audit.jsonl'), join(attemptRoot, 'audit.jsonl'));
  if (checkpointPath !== undefined) {
    await copyFileIfExists(checkpointPath, join(attemptRoot, 'checkpoint.txt'));
  }
}

async function writeCodexAttemptArtifacts({
  attemptRoot,
  promptText,
  mainRun,
  lastMessagePath,
  checkpointPath,
}) {
  await ensureDir(attemptRoot);
  await writeText(join(attemptRoot, 'prompt.md'), promptText);
  await writeText(join(attemptRoot, 'events.jsonl'), safeText(mainRun.stdout, '(no stdout)\n'));
  await writeText(join(attemptRoot, 'stderr.log'), safeText(mainRun.stderr, '(no stderr)\n'));
  if (existsSync(lastMessagePath)) {
    const content = await readText(lastMessagePath);
    await writeText(
      join(attemptRoot, 'last-message.txt'),
      content.trim().length === 0 ? '(last message empty)\n' : content,
    );
  } else {
    await writeText(join(attemptRoot, 'last-message.txt'), '(last message missing)\n');
  }
  await writeJson(join(attemptRoot, 'run-metadata.json'), {
    exitCode: mainRun.exitCode,
    timedOut: mainRun.timedOut,
    interrupted: mainRun.interrupted ?? false,
    interruptDetectedAt: mainRun.interruptDetectedAt ?? null,
    startedAt: mainRun.startedAt,
    endedAt: mainRun.endedAt,
    checkpointPath: checkpointPath === undefined ? null : repoRelative(checkpointPath),
  });
  if (checkpointPath !== undefined) {
    await copyFileIfExists(checkpointPath, join(attemptRoot, 'checkpoint.txt'));
  }
}

async function runPromptLanguageLane({
  runId,
  model,
  workspaceRoot,
  laneResultsRoot,
  stateDir,
  bootstrapInfo,
  controlFile,
  restartCount,
  interventionCount,
  batch,
  timingEnvelope,
  scenarioConfig,
}) {
  await ensureDir(laneResultsRoot);
  await ensureDir(stateDir);
  const requiredArtifacts = requiredArtifactsForLane('pl-sequential');
  const scenarioKind = scenarioConfig.kind;
  const checkpointPath =
    scenarioConfig.interruptCheckpoint === undefined
      ? undefined
      : join(workspaceRoot, scenarioConfig.interruptCheckpoint);

  const promptStartSnapshot = await captureSystemSnapshot();
  await writeJson(join(laneResultsRoot, 'system-before.json'), promptStartSnapshot);

  const initialSnapshot = await snapshotWorkspaceFiles(workspaceRoot);

  const preflight = runProcess(
    process.execPath,
    [CLI, 'validate', '--runner', 'codex', '--mode', 'headless', '--json', '--file', controlFile],
    {
      cwd: workspaceRoot,
      timeoutMs: PREFLIGHT_TIMEOUT_MS,
    },
  );
  await writeText(join(laneResultsRoot, 'preflight.json'), safeText(preflight.stdout, '{}\n'));
  await writeText(
    join(laneResultsRoot, 'preflight-stderr.log'),
    safeText(preflight.stderr, '(no stderr)\n'),
  );

  let runReport = null;
  let mainRun = null;
  let blockedPreflight = false;
  const startedAtMs = Date.now();
  let endedAtMs = Date.now();
  let interrupted = false;
  let interruptedAtMs = null;
  let resumeStartedAtMs = null;
  let effectiveRestartCount = restartCount;

  if (preflight.exitCode === 0) {
    const cliArgs = [
      CLI,
      'run',
      '--runner',
      'codex',
      '--model',
      model,
      '--state-dir',
      stateDir,
      '--json',
      '--file',
      controlFile,
    ];
    const runOptions = {
      cwd: workspaceRoot,
      timeoutMs: LANE_TIMEOUT_MS,
      env: {
        PROMPT_LANGUAGE_CODEX_TIMEOUT_MS: String(LANE_TIMEOUT_MS),
        PROMPT_LANGUAGE_CMD_TIMEOUT_MS: String(VERIFICATION_TIMEOUT_MS),
      },
    };

    if (scenarioKind === 'recovery') {
      const firstAttempt = await runProcessWithCheckpointInterruption(process.execPath, cliArgs, {
        ...runOptions,
        checkpointPath,
      });
      await writePromptLanguageAttemptArtifacts({
        attemptRoot: join(laneResultsRoot, 'attempt-1'),
        preflight,
        mainRun: firstAttempt,
        stateDir,
        checkpointPath,
      });
      interrupted = firstAttempt.interrupted;
      interruptedAtMs =
        firstAttempt.interruptDetectedAt === null
          ? null
          : Date.parse(firstAttempt.interruptDetectedAt);
      if (interrupted) {
        effectiveRestartCount += 1;
        resumeStartedAtMs = Date.now();
        mainRun = runProcess(process.execPath, cliArgs, runOptions);
        await writePromptLanguageAttemptArtifacts({
          attemptRoot: join(laneResultsRoot, 'attempt-2'),
          preflight: null,
          mainRun,
          stateDir,
          checkpointPath,
        });
      } else {
        mainRun = firstAttempt;
      }
    } else {
      mainRun = runProcess(process.execPath, cliArgs, runOptions);
    }

    await writeText(join(laneResultsRoot, 'run-report.json'), safeText(mainRun.stdout, '{}\n'));
    await writeText(
      join(laneResultsRoot, 'run-stderr.log'),
      safeText(mainRun.stderr, '(no stderr)\n'),
    );
    runReport = parseJson(mainRun.stdout.trim());
    endedAtMs = Date.now();
  } else {
    blockedPreflight = true;
  }

  const lintResult = await runVerificationCommand('lint', workspaceRoot, laneResultsRoot);
  const typecheckResult = await runVerificationCommand('typecheck', workspaceRoot, laneResultsRoot);
  const testResult = await runVerificationCommand('test', workspaceRoot, laneResultsRoot);

  endedAtMs = Date.now();
  const artifacts = await existingRequiredArtifacts(workspaceRoot, requiredArtifacts);
  const systemAfter = await captureSystemSnapshot();
  await writeJson(join(laneResultsRoot, 'system-after.json'), systemAfter);

  const verification = {
    lint: verificationState(lintResult),
    typecheck: verificationState(typecheckResult),
    test: verificationState(testResult),
  };
  const closure = determineLaneClosure({
    artifactsComplete: artifacts.complete,
    verification,
    anyArtifactsPresent: artifacts.present.length > 0,
  });

  const runtimeFailureCount =
    (preflight.exitCode === 0 ? 0 : 1) +
    (mainRun !== null && mainRun.exitCode !== 0 && runReport?.status !== 'unsuccessful' ? 1 : 0);

  const traceArtifacts = [
    repoRelative(join(stateDir, 'session-state.json')),
    repoRelative(join(stateDir, 'audit.jsonl')),
    repoRelative(join(laneResultsRoot, 'lint.log')),
    repoRelative(join(laneResultsRoot, 'typecheck.log')),
    repoRelative(join(laneResultsRoot, 'test.log')),
  ];
  const traceCompleteness = traceCompletenessFor([
    join(stateDir, 'session-state.json'),
    join(stateDir, 'audit.jsonl'),
    join(laneResultsRoot, 'lint.log'),
    join(laneResultsRoot, 'typecheck.log'),
    join(laneResultsRoot, 'test.log'),
  ]);

  const timeToFirstCodeSec = await detectFirstRelevantWrite(
    workspaceRoot,
    initialSnapshot,
    startedAtMs,
  );
  const verificationPassed = Object.values(verification).every((value) => value === 'pass');
  const timeToGreenSec = verificationPassed ? roundSeconds((endedAtMs - startedAtMs) / 1000) : null;
  const interruptToGreenSec =
    interrupted && interruptedAtMs !== null && verificationPassed
      ? roundSeconds((endedAtMs - interruptedAtMs) / 1000)
      : null;
  const resumeToGreenSec =
    resumeStartedAtMs !== null && verificationPassed
      ? roundSeconds((endedAtMs - resumeStartedAtMs) / 1000)
      : null;
  const failureClass = determineFailureClass({
    runtimeFailureCount,
    blockedPreflight,
    mainStatus: runReport?.status ?? (mainRun?.exitCode === 0 ? 'ok' : 'failed'),
    traceCompleteness,
  });

  const metrics = {
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: new Date(endedAtMs).toISOString(),
    timeToGreenSec,
    timeToFirstCodeSec: timeToFirstCodeSec,
    timeToFirstRelevantWriteSec: timeToFirstCodeSec,
    interventionCount,
    restartCount: effectiveRestartCount,
    runtimeFailureCount,
    failureClass,
    throughputMetricsComplete:
      scenarioKind === 'throughput' &&
      timeToGreenSec !== null &&
      timeToFirstCodeSec !== null &&
      traceCompleteness === 'strong',
    traceCompleteness,
    interrupted,
    interruptionStage: interrupted ? (scenarioConfig.interruptStage ?? 'unknown') : null,
    interruptToGreenSec,
    resumeToGreenSec,
    recoveryMetricsComplete:
      scenarioKind === 'recovery' &&
      interrupted &&
      interruptToGreenSec !== null &&
      resumeToGreenSec !== null &&
      traceCompleteness === 'strong',
    recoveredAfterInterruption:
      scenarioKind === 'recovery' && interrupted && closure.verdict === 'success',
  };

  const manifest = {
    runId,
    lane: 'pl-sequential',
    candidate: 'prompt-language',
    model,
    batch,
    timingEnvelope,
    status: closure.status,
    verdict: closure.verdict,
    workspaceRoot,
    resultsRoot: laneResultsRoot,
    stateDir,
    controlFile,
    bootstrapSeed: bootstrapInfo,
    requiredArtifacts,
    verificationCommands: VERIFICATION_COMMANDS,
    verification,
    artifactsComplete: artifacts.complete,
    missingArtifacts: artifacts.missing,
    outcomePath: `experiments/results/e4-factory/runs/${runId}/outcome.md`,
    postmortemPath: `experiments/results/e4-factory/runs/${runId}/postmortem.md`,
    interventionsPath: `experiments/results/e4-factory/runs/${runId}/interventions.md`,
    scorecardPath: `experiments/results/e4-factory/runs/${runId}/scorecard.json`,
    traceSummaryPath: `experiments/results/e4-factory/runs/${runId}/trace-summary.md`,
    traceArtifacts,
    comparisonPath: 'experiments/results/e4-factory/comparison.md',
    comparisonUpdated: true,
    metrics,
    followups: [],
    scenario: scenarioKind,
  };

  await writeJson(join(laneResultsRoot, 'manifest.json'), manifest);
  await writeJson(join(laneResultsRoot, 'lane-summary.json'), {
    preflightExitCode: preflight.exitCode,
    preflightStatus: parseJson(preflight.stdout)?.status ?? null,
    runStatus: runReport?.status ?? null,
    artifactsPresent: artifacts.present,
    metrics,
  });

  return {
    lane: manifest.lane,
    candidate: manifest.candidate,
    manifest,
    verification,
    artifacts,
    metrics,
    runStatus: runReport?.status ?? null,
    preflightStatus: parseJson(preflight.stdout)?.status ?? null,
    notes:
      closure.verdict === 'success'
        ? scenarioKind === 'recovery'
          ? 'Prompt-language resumed from the forced pre-verification stop and closed the bounded CRM core successfully under the frozen bootstrap seed.'
          : 'Prompt-language completed the bounded CRM core and passed all verification commands under the frozen bootstrap seed.'
        : blockedPreflight
          ? 'Prompt-language preflight blocked before execution could start.'
          : scenarioKind === 'recovery'
            ? 'Prompt-language did not recover cleanly from the forced pre-verification stop under the frozen bootstrap seed.'
            : 'Prompt-language did not close the bounded CRM core cleanly under the frozen bootstrap seed.',
    traceSummary: {
      primaryTraces: [
        ...(scenarioKind === 'recovery'
          ? [repoRelative(join(laneResultsRoot, 'attempt-1', 'run-report.json'))]
          : []),
        repoRelative(join(stateDir, 'session-state.json')),
        repoRelative(join(stateDir, 'audit.jsonl')),
        repoRelative(join(laneResultsRoot, 'run-report.json')),
      ],
      observations: [
        `preflight status: ${parseJson(preflight.stdout)?.status ?? 'unparsed'}`,
        `run status: ${runReport?.status ?? 'not-run'}`,
        `verification: lint=${verification.lint}, typecheck=${verification.typecheck}, test=${verification.test}`,
        ...(scenarioKind === 'recovery'
          ? [
              `interrupted: ${metrics.interrupted}`,
              `resume to green seconds: ${metrics.resumeToGreenSec ?? 'n/a'}`,
            ]
          : []),
      ],
    },
  };
}

async function runCodexLane({
  runId,
  model,
  workspaceRoot,
  laneResultsRoot,
  bootstrapInfo,
  restartCount,
  interventionCount,
  batch,
  timingEnvelope,
  promptFile,
  scenarioConfig,
}) {
  await ensureDir(laneResultsRoot);
  const requiredArtifacts = requiredArtifactsForLane('codex-alone');
  const scenarioKind = scenarioConfig.kind;
  const checkpointPath =
    scenarioConfig.interruptCheckpoint === undefined
      ? undefined
      : join(workspaceRoot, scenarioConfig.interruptCheckpoint);

  const systemBefore = await captureSystemSnapshot();
  await writeJson(join(laneResultsRoot, 'system-before.json'), systemBefore);

  const initialSnapshot = await snapshotWorkspaceFiles(workspaceRoot);
  const promptText = await readText(promptFile);
  await writeText(join(laneResultsRoot, 'prompt.md'), promptText);

  const startedAtMs = Date.now();
  const lastMessagePath = join(laneResultsRoot, 'last-message.txt');
  const codexArgs = [
    'exec',
    '--dangerously-bypass-approvals-and-sandbox',
    '--skip-git-repo-check',
    '--json',
    '--output-last-message',
    lastMessagePath,
    '-C',
    workspaceRoot,
    '--model',
    model,
    '-',
  ];
  const [command, ...commandArgs] = codexBinaryCommand(...codexArgs);
  let mainRun;
  let interrupted = false;
  let interruptedAtMs = null;
  let resumeStartedAtMs = null;
  let effectiveRestartCount = restartCount;

  if (scenarioKind === 'recovery') {
    const firstAttemptRoot = join(laneResultsRoot, 'attempt-1');
    const firstAttemptLastMessagePath = join(firstAttemptRoot, 'last-message.txt');
    const firstAttemptArgs = [
      'exec',
      '--dangerously-bypass-approvals-and-sandbox',
      '--skip-git-repo-check',
      '--json',
      '--output-last-message',
      firstAttemptLastMessagePath,
      '-C',
      workspaceRoot,
      '--model',
      model,
      '-',
    ];
    const [firstCommand, ...firstCommandArgs] = codexBinaryCommand(...firstAttemptArgs);
    const firstAttempt = await runProcessWithCheckpointInterruption(
      firstCommand,
      firstCommandArgs,
      {
        cwd: workspaceRoot,
        input: promptText,
        timeoutMs: LANE_TIMEOUT_MS,
        checkpointPath,
      },
    );
    await writeCodexAttemptArtifacts({
      attemptRoot: firstAttemptRoot,
      promptText,
      mainRun: firstAttempt,
      lastMessagePath: firstAttemptLastMessagePath,
      checkpointPath,
    });
    interrupted = firstAttempt.interrupted;
    interruptedAtMs =
      firstAttempt.interruptDetectedAt === null
        ? null
        : Date.parse(firstAttempt.interruptDetectedAt);
    if (interrupted) {
      effectiveRestartCount += 1;
      resumeStartedAtMs = Date.now();
      mainRun = runProcess(command, commandArgs, {
        cwd: workspaceRoot,
        input: promptText,
        timeoutMs: LANE_TIMEOUT_MS,
      });
      await writeCodexAttemptArtifacts({
        attemptRoot: join(laneResultsRoot, 'attempt-2'),
        promptText,
        mainRun,
        lastMessagePath,
        checkpointPath,
      });
    } else {
      mainRun = firstAttempt;
    }
  } else {
    mainRun = runProcess(command, commandArgs, {
      cwd: workspaceRoot,
      input: promptText,
      timeoutMs: LANE_TIMEOUT_MS,
    });
  }
  await writeText(join(laneResultsRoot, 'events.jsonl'), safeText(mainRun.stdout, '(no stdout)\n'));
  await writeText(join(laneResultsRoot, 'stderr.log'), safeText(mainRun.stderr, '(no stderr)\n'));
  if (!existsSync(lastMessagePath)) {
    await writeText(lastMessagePath, '(last message missing)\n');
  } else {
    const content = await readText(lastMessagePath);
    if (content.trim().length === 0) {
      await writeText(lastMessagePath, '(last message empty)\n');
    }
  }

  const lintResult = await runVerificationCommand('lint', workspaceRoot, laneResultsRoot);
  const typecheckResult = await runVerificationCommand('typecheck', workspaceRoot, laneResultsRoot);
  const testResult = await runVerificationCommand('test', workspaceRoot, laneResultsRoot);

  const endedAtMs = Date.now();
  const artifacts = await existingRequiredArtifacts(workspaceRoot, requiredArtifacts);
  const systemAfter = await captureSystemSnapshot();
  await writeJson(join(laneResultsRoot, 'system-after.json'), systemAfter);

  const verification = {
    lint: verificationState(lintResult),
    typecheck: verificationState(typecheckResult),
    test: verificationState(testResult),
  };
  const closure = determineLaneClosure({
    artifactsComplete: artifacts.complete,
    verification,
    anyArtifactsPresent: artifacts.present.length > 0,
  });

  const runtimeFailureCount = mainRun.exitCode === 0 ? 0 : 1;
  const traceArtifacts = [
    repoRelative(join(laneResultsRoot, 'events.jsonl')),
    repoRelative(join(laneResultsRoot, 'stderr.log')),
    repoRelative(lastMessagePath),
    repoRelative(join(laneResultsRoot, 'lint.log')),
    repoRelative(join(laneResultsRoot, 'typecheck.log')),
    repoRelative(join(laneResultsRoot, 'test.log')),
  ];
  const traceCompleteness = traceCompletenessFor([
    join(laneResultsRoot, 'events.jsonl'),
    join(laneResultsRoot, 'stderr.log'),
    lastMessagePath,
    join(laneResultsRoot, 'lint.log'),
    join(laneResultsRoot, 'typecheck.log'),
    join(laneResultsRoot, 'test.log'),
  ]);

  const timeToFirstCodeSec = await detectFirstRelevantWrite(
    workspaceRoot,
    initialSnapshot,
    startedAtMs,
  );
  const verificationPassed = Object.values(verification).every((value) => value === 'pass');
  const timeToGreenSec = verificationPassed ? roundSeconds((endedAtMs - startedAtMs) / 1000) : null;
  const interruptToGreenSec =
    interrupted && interruptedAtMs !== null && verificationPassed
      ? roundSeconds((endedAtMs - interruptedAtMs) / 1000)
      : null;
  const resumeToGreenSec =
    resumeStartedAtMs !== null && verificationPassed
      ? roundSeconds((endedAtMs - resumeStartedAtMs) / 1000)
      : null;
  const failureClass = determineFailureClass({
    runtimeFailureCount,
    blockedPreflight: false,
    mainStatus: mainRun.exitCode === 0 ? 'ok' : 'failed',
    traceCompleteness,
  });

  const metrics = {
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: new Date(endedAtMs).toISOString(),
    timeToGreenSec,
    timeToFirstCodeSec: timeToFirstCodeSec,
    timeToFirstRelevantWriteSec: timeToFirstCodeSec,
    interventionCount,
    restartCount: effectiveRestartCount,
    runtimeFailureCount,
    failureClass,
    throughputMetricsComplete:
      scenarioKind === 'throughput' &&
      timeToGreenSec !== null &&
      timeToFirstCodeSec !== null &&
      traceCompleteness === 'strong',
    traceCompleteness,
    interrupted,
    interruptionStage: interrupted ? (scenarioConfig.interruptStage ?? 'unknown') : null,
    interruptToGreenSec,
    resumeToGreenSec,
    recoveryMetricsComplete:
      scenarioKind === 'recovery' &&
      interrupted &&
      interruptToGreenSec !== null &&
      resumeToGreenSec !== null &&
      traceCompleteness === 'strong',
    recoveredAfterInterruption:
      scenarioKind === 'recovery' && interrupted && closure.verdict === 'success',
  };

  const manifest = {
    runId,
    lane: 'codex-alone',
    candidate: 'codex-alone',
    model,
    batch,
    timingEnvelope,
    status: closure.status,
    verdict: closure.verdict,
    workspaceRoot,
    resultsRoot: laneResultsRoot,
    promptFile: join(laneResultsRoot, 'prompt.md'),
    bootstrapSeed: bootstrapInfo,
    requiredArtifacts,
    verificationCommands: VERIFICATION_COMMANDS,
    verification,
    artifactsComplete: artifacts.complete,
    missingArtifacts: artifacts.missing,
    outcomePath: `experiments/results/e4-factory/runs/${runId}/outcome.md`,
    postmortemPath: `experiments/results/e4-factory/runs/${runId}/postmortem.md`,
    interventionsPath: `experiments/results/e4-factory/runs/${runId}/interventions.md`,
    scorecardPath: `experiments/results/e4-factory/runs/${runId}/scorecard.json`,
    traceSummaryPath: `experiments/results/e4-factory/runs/${runId}/trace-summary.md`,
    traceArtifacts,
    comparisonPath: 'experiments/results/e4-factory/comparison.md',
    comparisonUpdated: true,
    metrics,
    followups: [],
    scenario: scenarioKind,
  };

  await writeJson(join(laneResultsRoot, 'manifest.json'), manifest);
  await writeJson(join(laneResultsRoot, 'lane-summary.json'), {
    mainExitCode: mainRun.exitCode,
    artifactsPresent: artifacts.present,
    metrics,
  });

  return {
    lane: manifest.lane,
    candidate: manifest.candidate,
    manifest,
    verification,
    artifacts,
    metrics,
    runStatus: mainRun.exitCode === 0 ? 'ok' : 'failed',
    notes:
      closure.verdict === 'success'
        ? scenarioKind === 'recovery'
          ? 'Direct Codex resumed from the forced pre-verification stop and closed the bounded CRM core successfully under the frozen bootstrap seed.'
          : 'Direct Codex completed the bounded CRM core and passed all verification commands under the frozen bootstrap seed.'
        : scenarioKind === 'recovery'
          ? 'Direct Codex did not recover cleanly from the forced pre-verification stop under the frozen bootstrap seed.'
          : 'Direct Codex did not close the bounded CRM core cleanly under the frozen bootstrap seed.',
    traceSummary: {
      primaryTraces: [
        ...(scenarioKind === 'recovery'
          ? [repoRelative(join(laneResultsRoot, 'attempt-1', 'events.jsonl'))]
          : []),
        repoRelative(join(laneResultsRoot, 'events.jsonl')),
        repoRelative(join(laneResultsRoot, 'stderr.log')),
        repoRelative(lastMessagePath),
      ],
      observations: [
        `main exit code: ${mainRun.exitCode}`,
        `verification: lint=${verification.lint}, typecheck=${verification.typecheck}, test=${verification.test}`,
        `artifacts complete: ${artifacts.complete}`,
        ...(scenarioKind === 'recovery'
          ? [
              `interrupted: ${metrics.interrupted}`,
              `resume to green seconds: ${metrics.resumeToGreenSec ?? 'n/a'}`,
            ]
          : []),
      ],
    },
  };
}

function determineComparativeVerdict(plLane, codexLane, scenarioConfig) {
  if (scenarioConfig.kind === 'recovery') {
    const plRecovered = plLane.metrics.recoveredAfterInterruption === true;
    const codexRecovered = codexLane.metrics.recoveredAfterInterruption === true;

    if (plRecovered && !codexRecovered) {
      return 'prompt-language-better';
    }
    if (!plRecovered && codexRecovered) {
      return 'codex-alone-better';
    }
    if (!plRecovered && !codexRecovered) {
      return 'inconclusive';
    }

    if (plLane.metrics.resumeToGreenSec === null || codexLane.metrics.resumeToGreenSec === null) {
      return 'mixed';
    }

    const faster = Math.min(plLane.metrics.resumeToGreenSec, codexLane.metrics.resumeToGreenSec);
    const slower = Math.max(plLane.metrics.resumeToGreenSec, codexLane.metrics.resumeToGreenSec);
    const deltaRatio = slower === 0 ? 0 : (slower - faster) / slower;

    if (deltaRatio < 0.1) {
      return 'parity';
    }

    return plLane.metrics.resumeToGreenSec < codexLane.metrics.resumeToGreenSec
      ? 'prompt-language-better'
      : 'codex-alone-better';
  }

  const plSuccess = plLane.manifest.verdict === 'success';
  const codexSuccess = codexLane.manifest.verdict === 'success';

  if (plSuccess && !codexSuccess) {
    return 'prompt-language-better';
  }
  if (!plSuccess && codexSuccess) {
    return 'codex-alone-better';
  }

  if (plLane.metrics.timeToGreenSec === null || codexLane.metrics.timeToGreenSec === null) {
    return plSuccess === codexSuccess ? 'mixed' : 'inconclusive';
  }

  const faster = Math.min(plLane.metrics.timeToGreenSec, codexLane.metrics.timeToGreenSec);
  const slower = Math.max(plLane.metrics.timeToGreenSec, codexLane.metrics.timeToGreenSec);
  const deltaRatio = slower === 0 ? 0 : (slower - faster) / slower;

  if (deltaRatio < 0.1) {
    return 'parity';
  }

  const greenWinner =
    plLane.metrics.timeToGreenSec < codexLane.metrics.timeToGreenSec
      ? 'prompt-language-better'
      : 'codex-alone-better';
  return greenWinner;
}

function buildAdmissibility(plLane, codexLane, scenarioConfig) {
  if (scenarioConfig.kind === 'recovery') {
    const cleanRecoveryPair =
      plLane.metrics.interrupted === true &&
      codexLane.metrics.interrupted === true &&
      plLane.metrics.traceCompleteness === 'strong' &&
      codexLane.metrics.traceCompleteness === 'strong';

    return {
      class: 'supporting-context',
      throughputClaimEligible: false,
      reason: cleanRecoveryPair
        ? 'This is a trace-backed S2 governed-recovery pilot on the same bounded CRM contract, but it remains supporting context until repeated predeclared interruption/resume pairs agree.'
        : 'This is an S2 governed-recovery attempt, but interruption timing, resume handling, or trace completeness still leaves it as supporting context only.',
      recoveryClaimEligible: false,
    };
  }

  const cleanComparablePair =
    plLane.manifest.verdict === 'success' &&
    codexLane.manifest.verdict === 'success' &&
    plLane.metrics.throughputMetricsComplete &&
    codexLane.metrics.throughputMetricsComplete &&
    plLane.metrics.runtimeFailureCount === 0 &&
    codexLane.metrics.runtimeFailureCount === 0;
  const throughputClaimEligible = false;

  return {
    class: 'primary-comparison',
    throughputClaimEligible,
    reason: cleanComparablePair
      ? 'This is a clean paired timed run on the same common product contract, but throughput superiority remains provisional until order effects are counterbalanced or repeated clean pairs agree.'
      : 'This is a paired patched run, but at least one lane did not close the same product contract or still has missing throughput metrics / runtime confounds, so any throughput read is provisional.',
  };
}

function buildLaneScores(lane, paired, admissibility) {
  const verificationPassCount = totalVerificationPasses(lane.verification);
  const product = scoreProductOutcome(lane.artifacts.complete, verificationPassCount);
  const scores = {
    ...product,
    setupSimplicity: scoreSetupSimplicity(
      lane.metrics.runtimeFailureCount,
      lane.metrics.restartCount,
      lane.metrics.interventionCount,
    ),
    auditability: scoreAuditability(lane.metrics.traceCompleteness),
    experimentalControl: scoreExperimentalControl(
      paired,
      lane.metrics.throughputMetricsComplete,
      lane.metrics.traceCompleteness,
      admissibility,
    ),
    automationIntegrity: scoreAutomationIntegrity(
      lane.metrics.runtimeFailureCount,
      lane.metrics.restartCount,
      lane.metrics.interventionCount,
    ),
    repeatabilityEvidence: scoreRepeatabilityEvidence(admissibility),
  };

  const totals = {
    productOutcome: scores.scopeCompletion + scores.verification + scores.artifactCompleteness,
    operationalQuality: scores.setupSimplicity + scores.auditability,
    researchStrength:
      scores.experimentalControl + scores.automationIntegrity + scores.repeatabilityEvidence,
    overall: 0,
  };
  totals.overall = totals.productOutcome + totals.operationalQuality + totals.researchStrength;

  return { scores, totals };
}

function buildScoreEvidence(runId, lane) {
  const prefix = `experiments/results/e4-factory/runs/${runId}`;
  const lanePrefix = `${prefix}/${lane.manifest.lane}`;
  const batchPrefix =
    lane.manifest.batch === null
      ? null
      : `experiments/results/e4-factory/batches/${lane.manifest.batch.batchId}/summary.json`;

  return {
    scopeCompletion: [`${prefix}/outcome.md`],
    verification: [
      `${lanePrefix}/lint.log`,
      `${lanePrefix}/typecheck.log`,
      `${lanePrefix}/test.log`,
    ],
    artifactCompleteness: [`${prefix}/outcome.md`],
    setupSimplicity: [`${prefix}/postmortem.md`],
    auditability: [`${prefix}/trace-summary.md`],
    experimentalControl: [`${prefix}/trace-summary.md`],
    automationIntegrity: [`${prefix}/interventions.md`],
    repeatabilityEvidence: [batchPrefix ?? `${prefix}/scorecard.json`],
  };
}

async function writeRunOutcome(
  runRoot,
  runId,
  order,
  plLane,
  codexLane,
  comparativeVerdict,
  admissibility,
  scenarioConfig,
) {
  const scenarioSection =
    scenarioConfig.kind === 'recovery'
      ? [
          '## Governed Recovery',
          '',
          `- \`prompt-language\` interrupted as planned: ${plLane.metrics.interrupted}`,
          `- \`prompt-language\` recovered after interruption: ${plLane.metrics.recoveredAfterInterruption}`,
          `- \`prompt-language\` interrupt to green: ${plLane.metrics.interruptToGreenSec ?? 'n/a'}s`,
          `- \`prompt-language\` resume to green: ${plLane.metrics.resumeToGreenSec ?? 'n/a'}s`,
          `- \`codex-alone\` interrupted as planned: ${codexLane.metrics.interrupted}`,
          `- \`codex-alone\` recovered after interruption: ${codexLane.metrics.recoveredAfterInterruption}`,
          `- \`codex-alone\` interrupt to green: ${codexLane.metrics.interruptToGreenSec ?? 'n/a'}s`,
          `- \`codex-alone\` resume to green: ${codexLane.metrics.resumeToGreenSec ?? 'n/a'}s`,
          '',
        ]
      : [
          '## Throughput',
          '',
          `- \`prompt-language\` time to green: ${plLane.metrics.timeToGreenSec ?? 'n/a'}s`,
          `- \`prompt-language\` time to first relevant write: ${plLane.metrics.timeToFirstRelevantWriteSec ?? 'n/a'}s`,
          `- \`codex-alone\` time to green: ${codexLane.metrics.timeToGreenSec ?? 'n/a'}s`,
          `- \`codex-alone\` time to first relevant write: ${codexLane.metrics.timeToFirstRelevantWriteSec ?? 'n/a'}s`,
          `- admissible for throughput claim: ${admissibility.throughputClaimEligible}`,
          '',
        ];

  const content = [
    '# Outcome',
    '',
    `Run: \`${runId}\``,
    `Order: \`${order}\``,
    `Scenario: \`${scenarioConfig.kind}\``,
    '',
    '## Lane Results',
    '',
    `- \`prompt-language\`: \`${plLane.manifest.verdict}\` (${plLane.manifest.status})`,
    `- \`codex-alone\`: \`${codexLane.manifest.verdict}\` (${codexLane.manifest.status})`,
    '',
    '## Verification',
    '',
    `- \`prompt-language\`: lint=${plLane.verification.lint}, typecheck=${plLane.verification.typecheck}, test=${plLane.verification.test}`,
    `- \`codex-alone\`: lint=${codexLane.verification.lint}, typecheck=${codexLane.verification.typecheck}, test=${codexLane.verification.test}`,
    '',
    ...scenarioSection,
    '## Verdict',
    '',
    `- comparative verdict: \`${comparativeVerdict}\``,
    `- admissibility: \`${admissibility.class}\``,
    `- reason: ${admissibility.reason}`,
    '',
  ].join('\n');

  await writeText(join(runRoot, 'outcome.md'), content);
}

async function writeRunPostmortem(
  runRoot,
  runId,
  plLane,
  codexLane,
  admissibility,
  scenarioConfig,
) {
  const issues = [
    ...(plLane.metrics.failureClass !== 'none'
      ? [`prompt-language failure class: ${plLane.metrics.failureClass}`]
      : []),
    ...(codexLane.metrics.failureClass !== 'none'
      ? [`codex-alone failure class: ${codexLane.metrics.failureClass}`]
      : []),
  ];

  const content = [
    '# Postmortem',
    '',
    `Run: \`${runId}\``,
    `Scenario: \`${scenarioConfig.kind}\``,
    '',
    '## What Happened',
    '',
    `- prompt-language: ${plLane.notes}`,
    `- codex-alone: ${codexLane.notes}`,
    '',
    '## Confounds',
    '',
    ...(issues.length > 0
      ? issues.map((issue) => `- ${issue}`)
      : ['- no runtime or config confounds were recorded in this run']),
    `- throughput admissibility: ${admissibility.reason}`,
    '',
    '## Next Actions',
    '',
    ...(scenarioConfig.kind === 'recovery'
      ? [
          '- repeat the S2 interruption/resume pilot in both orders before making a governed-recovery claim',
          '- keep the clean B02 throughput result separate from any recovery interpretation',
        ]
      : [
          '- replicate this paired run at least three times before making a stable superiority claim',
          '- add interruption and resume scenarios only after clean S0 pairs accumulate',
        ]),
    '',
  ].join('\n');

  await writeText(join(runRoot, 'postmortem.md'), content);
}

async function writeRunInterventions(
  runRoot,
  runId,
  plLane,
  codexLane,
  documentedHumanInterventions,
  scenarioConfig,
) {
  const content = [
    '# Interventions',
    '',
    `Run: \`${runId}\``,
    `Scenario: \`${scenarioConfig.kind}\``,
    '',
    `- documented human interventions: ${documentedHumanInterventions}`,
    '- prompt-language restart count: ' + plLane.metrics.restartCount,
    '- codex-alone restart count: ' + codexLane.metrics.restartCount,
    '- observation mode: counts are recorded from the harness invocation inputs, not inferred after the fact',
    ...(scenarioConfig.kind === 'recovery'
      ? [
          `- prompt-language interrupted as planned: ${plLane.metrics.interrupted}`,
          `- codex-alone interrupted as planned: ${codexLane.metrics.interrupted}`,
        ]
      : []),
    '',
  ].join('\n');

  await writeText(join(runRoot, 'interventions.md'), content);
}

async function writeRunTraceSummary(
  runRoot,
  runId,
  plLane,
  codexLane,
  comparativeVerdict,
  scenarioConfig,
) {
  const content = [
    '# Trace Summary',
    '',
    `Run: \`${runId}\``,
    '',
    '## Lane Traces',
    '',
    '### `pl-sequential`',
    '',
    'Primary traces:',
    '',
    ...plLane.traceSummary.primaryTraces.map((path) => `- \`${path}\``),
    '',
    'What they show:',
    '',
    ...plLane.traceSummary.observations.map((line) => `- ${line}`),
    '',
    '### `codex-alone`',
    '',
    'Primary traces:',
    '',
    ...codexLane.traceSummary.primaryTraces.map((path) => `- \`${path}\``),
    '',
    'What they show:',
    '',
    ...codexLane.traceSummary.observations.map((line) => `- ${line}`),
    '',
    '## Comparative Read',
    '',
    `- current comparative verdict: \`${comparativeVerdict}\``,
    `- prompt-language trace completeness: \`${plLane.metrics.traceCompleteness}\``,
    `- codex-alone trace completeness: \`${codexLane.metrics.traceCompleteness}\``,
    ...(scenarioConfig.kind === 'recovery'
      ? [
          `- prompt-language resume to green: \`${plLane.metrics.resumeToGreenSec ?? 'n/a'}\``,
          `- codex-alone resume to green: \`${codexLane.metrics.resumeToGreenSec ?? 'n/a'}\``,
        ]
      : []),
    '',
    '## Confounds',
    '',
    `- prompt-language failure class: \`${plLane.metrics.failureClass}\``,
    `- codex-alone failure class: \`${codexLane.metrics.failureClass}\``,
    '',
  ].join('\n');

  await writeText(join(runRoot, 'trace-summary.md'), content);
}

async function writeScorecard(
  runRoot,
  runId,
  plLane,
  codexLane,
  comparativeVerdict,
  admissibility,
  runMetadata,
  scenarioConfig,
) {
  const plScoring = buildLaneScores(plLane, true, admissibility);
  const codexScoring = buildLaneScores(codexLane, true, admissibility);

  const scorecard = {
    scoreVersion: 'e4-v1',
    runId,
    batch: runMetadata.batch ?? null,
    scope: 'bounded-crm-core',
    question: scenarioConfig.question,
    baselineReference: 'codex-alone within this run',
    admissibility,
    comparativeVerdict,
    lanes: [
      {
        lane: plLane.manifest.lane,
        candidate: plLane.candidate,
        status: plLane.manifest.status,
        verdict: plLane.manifest.verdict,
        metrics: {
          timeToGreenSec: plLane.metrics.timeToGreenSec,
          timeToFirstCodeSec: plLane.metrics.timeToFirstCodeSec,
          timeToFirstRelevantWriteSec: plLane.metrics.timeToFirstRelevantWriteSec,
          interventionCount: plLane.metrics.interventionCount,
          restartCount: plLane.metrics.restartCount,
          runtimeFailureCount: plLane.metrics.runtimeFailureCount,
          failureClass: plLane.metrics.failureClass,
          throughputMetricsComplete: plLane.metrics.throughputMetricsComplete,
          traceCompleteness: plLane.metrics.traceCompleteness,
        },
        scores: plScoring.scores,
        totals: plScoring.totals,
        scoreEvidence: buildScoreEvidence(runId, plLane),
        notes: plLane.notes,
      },
      {
        lane: codexLane.manifest.lane,
        candidate: codexLane.candidate,
        status: codexLane.manifest.status,
        verdict: codexLane.manifest.verdict,
        metrics: {
          timeToGreenSec: codexLane.metrics.timeToGreenSec,
          timeToFirstCodeSec: codexLane.metrics.timeToFirstCodeSec,
          timeToFirstRelevantWriteSec: codexLane.metrics.timeToFirstRelevantWriteSec,
          interventionCount: codexLane.metrics.interventionCount,
          restartCount: codexLane.metrics.restartCount,
          runtimeFailureCount: codexLane.metrics.runtimeFailureCount,
          failureClass: codexLane.metrics.failureClass,
          throughputMetricsComplete: codexLane.metrics.throughputMetricsComplete,
          traceCompleteness: codexLane.metrics.traceCompleteness,
        },
        scores: codexScoring.scores,
        totals: codexScoring.totals,
        scoreEvidence: buildScoreEvidence(runId, codexLane),
        notes: codexLane.notes,
      },
    ],
    comparativeSummary:
      comparativeVerdict === 'parity'
        ? 'Both lanes reached the same bounded CRM outcome with similar time-to-green in this paired run.'
        : comparativeVerdict === 'prompt-language-better'
          ? 'Prompt-language outperformed the direct Codex baseline in this paired run.'
          : comparativeVerdict === 'codex-alone-better'
            ? 'Both lanes closed the common product contract, but direct Codex reached time-to-green faster in this paired run.'
            : 'Both lanes closed the common product contract, but the paired run still produced a mixed result on the available evidence.',
    nextExperimentFocus:
      scenarioConfig.kind === 'recovery'
        ? [
            'repeat the governed S2 interruption/resume pair in both orders',
            'promote recovery claims only after repeated trace-backed pairs agree',
          ]
        : [
            'repeat the clean paired run to stabilize the throughput reading',
            'add interruption and resume scenarios only after several clean pairs agree',
          ],
  };

  await writeJson(join(runRoot, 'scorecard.json'), scorecard);
  return scorecard;
}

async function updateComparison(
  runId,
  attemptLabel,
  plLane,
  codexLane,
  comparativeVerdict,
  admissibility,
  runMetadata,
  scenarioConfig,
) {
  const text = await readText(COMPARISON_PATH);
  const batchLine =
    runMetadata.batch === null
      ? null
      : `- batch: \`${runMetadata.batch.batchId}\`${runMetadata.batch.pairId ? ` pair \`${runMetadata.batch.pairId}\`` : ''}`;
  const runSection = [
    `### ${attemptLabel}: \`${runId}\``,
    '',
    `- \`prompt-language\` sequential lane: ${plLane.manifest.verdict}`,
    `- direct Codex lane: ${codexLane.manifest.verdict}`,
    '',
    'Meaning:',
    '',
    `- timing envelope: \`${runMetadata.timingEnvelope}\``,
    `- scenario kind: \`${scenarioConfig.kind}\``,
    batchLine,
    `- comparative verdict: \`${comparativeVerdict}\``,
    ...(scenarioConfig.kind === 'recovery'
      ? [
          '- governed recovery pilot: true',
          `- prompt-language resume to green: ${plLane.metrics.resumeToGreenSec ?? 'n/a'}s`,
          `- codex-alone resume to green: ${codexLane.metrics.resumeToGreenSec ?? 'n/a'}s`,
        ]
      : [`- throughput admissible: ${admissibility.throughputClaimEligible}`]),
    '',
    'Primary evidence:',
    '',
    `- [${attemptLabel} outcome](./runs/${runId}/outcome.md)`,
    `- [${attemptLabel} postmortem](./runs/${runId}/postmortem.md)`,
    `- [${attemptLabel} scorecard](./runs/${runId}/scorecard.json)`,
    `- [${attemptLabel} trace summary](./runs/${runId}/trace-summary.md)`,
    '',
  ].join('\n');

  const beforeInterpretation = '\n## Current Interpretation\n';
  const updatedText = text.includes(beforeInterpretation)
    ? text.replace(beforeInterpretation, `\n${runSection}${beforeInterpretation}`)
    : `${text.trim()}\n\n${runSection}`;

  if (scenarioConfig.kind === 'recovery') {
    await writeText(COMPARISON_PATH, `${updatedText.trim()}\n`);
    return;
  }

  const throughputBlock = admissibility.throughputClaimEligible
    ? [
        'Throughput note:',
        '',
        `- \`${attemptLabel}\` is part of a counterbalanced batch with lane-appropriate artifact contracts, explicit timings, and complete raw traces`,
        `- provisional raw-throughput verdict: \`${comparativeVerdict}\``,
        '- both lanes closed the same common product contract in this run',
        '- superiority still belongs to the batch summary, not this one pair in isolation',
      ].join('\n')
    : [
        'Throughput note:',
        '',
        '- no current run is admissible for a stable throughput-superiority claim',
        `- \`${attemptLabel}\` is paired and timed on the same common product contract, but throughput claims stay provisional until the counterbalanced batch summary says otherwise`,
        '- repeat the patched clean pair before making a stronger throughput claim',
      ].join('\n');

  const finalText = updatedText.replace(/Throughput note:\n[\s\S]*$/u, throughputBlock);
  await writeText(COMPARISON_PATH, `${finalText.trim()}\n`);
}

async function updateAnalysis(runId, attemptLabel, scorecard, runMetadata, scenarioConfig) {
  const existing = await readText(ANALYSIS_PATH);
  if (existing.includes(runId)) {
    return;
  }

  const comparativeVerdict = scorecard.comparativeVerdict;
  const admissibility = scorecard.admissibility;
  const note = [
    '',
    `## ${attemptLabel} Update`,
    '',
    `Run: \`${runId}\``,
    '',
    `- scenario kind: \`${scenarioConfig.kind}\``,
    `- comparative verdict: \`${comparativeVerdict}\``,
    ...(scenarioConfig.kind === 'recovery'
      ? [
          '- recovery pilot: true',
          `- prompt-language resume to green: ${scorecard.lanes[0]?.metrics.resumeToGreenSec ?? 'n/a'}s`,
          `- codex-alone resume to green: ${scorecard.lanes[1]?.metrics.resumeToGreenSec ?? 'n/a'}s`,
        ]
      : [`- throughput admissible: ${admissibility.throughputClaimEligible}`]),
    `- admissibility reason: ${admissibility.reason}`,
    `- timing envelope: \`${runMetadata.timingEnvelope}\``,
    '',
  ].join('\n');

  await writeText(ANALYSIS_PATH, `${existing.trim()}\n${note}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const attemptNumber = await nextAttemptNumber();
  const attemptLabel = options.attemptLabel ?? `A${String(attemptNumber).padStart(2, '0')}`;
  const scenarioConfig = scenarioConfigFor(options.scenario);
  const controlFile = scenarioConfig.controlFile;
  const promptFile = promptFileForScenario(options.scenario);
  const timingEnvelope = scenarioConfig.timingEnvelope;
  const runId =
    options.runId ??
    `${formatRunTimestamp(new Date())}-a${String(attemptNumber).padStart(2, '0')}-core-proof-paired-clean`;

  const runRoot = join(RUNS_ROOT, runId);
  const workspaceRunRoot = join(WORKSPACES_ROOT, runId);
  await ensureDir(runRoot);
  await ensureDir(workspaceRunRoot);

  const seedHash = await computeDirectoryHash(SEED_ROOT);
  const overlayHash = await computeDirectoryHash(PL_OVERLAY_ROOT);
  const controlHash = await computeFileHash(controlFile);
  const promptHash = await computeFileHash(promptFile);
  const bootstrapInfo = buildBootstrapInfo(seedHash, overlayHash);
  const batch =
    options.batchId === null
      ? null
      : {
          batchId: options.batchId,
          pairId: options.pairId,
        };

  const metadata = {
    runId,
    attemptLabel,
    scenario: options.scenario,
    order: options.order,
    model: options.model,
    batch,
    startedAt: nowIso(),
    gitCommit: readGitHead(),
    gitStatusShort: readGitStatusShort(),
    nodeVersion: process.version,
    npmVersion: readNpmVersion(),
    codexVersion: readCodexVersion(),
    controlFile: repoRelative(controlFile),
    controlHash,
    promptFile: repoRelative(promptFile),
    promptHash,
    bootstrapSeed: bootstrapInfo,
    timingEnvelope,
    documentedHumanInterventions: options.documentedHumanInterventions,
    interventionObservationMode: 'harness-parameterized',
  };
  await writeJson(join(runRoot, 'run.json'), metadata);

  let completed = false;
  let preparedSeedRoot = null;

  try {
    preparedSeedRoot = await prepareSeed(runRoot, bootstrapInfo);
    const plWorkspace = join(workspaceRunRoot, 'pl-sequential');
    const codexWorkspace = join(workspaceRunRoot, 'codex-alone');
    const plResultsRoot = join(runRoot, 'pl-sequential');
    const codexResultsRoot = join(runRoot, 'codex-alone');
    const plStateDir = join(runRoot, 'pl-state');

    await materializeLaneWorkspace(preparedSeedRoot, plWorkspace, PL_OVERLAY_ROOT);
    await materializeLaneWorkspace(preparedSeedRoot, codexWorkspace);

    const lanesInOrder =
      options.order === 'codex-first'
        ? [
            { key: 'codex', workspaceRoot: codexWorkspace, resultsRoot: codexResultsRoot },
            {
              key: 'pl',
              workspaceRoot: plWorkspace,
              resultsRoot: plResultsRoot,
              stateDir: plStateDir,
            },
          ]
        : [
            {
              key: 'pl',
              workspaceRoot: plWorkspace,
              resultsRoot: plResultsRoot,
              stateDir: plStateDir,
            },
            { key: 'codex', workspaceRoot: codexWorkspace, resultsRoot: codexResultsRoot },
          ];

    const laneResults = {};

    for (const lane of lanesInOrder) {
      if (lane.key === 'pl') {
        laneResults.pl = await runPromptLanguageLane({
          runId,
          model: options.model,
          workspaceRoot: lane.workspaceRoot,
          laneResultsRoot: lane.resultsRoot,
          stateDir: lane.stateDir,
          bootstrapInfo,
          controlFile,
          restartCount: options.plRestartCount,
          interventionCount: options.documentedHumanInterventions,
          batch,
          timingEnvelope,
          scenarioConfig,
        });
      } else {
        laneResults.codex = await runCodexLane({
          runId,
          model: options.model,
          workspaceRoot: lane.workspaceRoot,
          laneResultsRoot: lane.resultsRoot,
          bootstrapInfo,
          restartCount: options.codexRestartCount,
          interventionCount: options.documentedHumanInterventions,
          batch,
          timingEnvelope,
          promptFile,
          scenarioConfig,
        });
      }
    }

    const plLane = laneResults.pl;
    const codexLane = laneResults.codex;
    if (plLane === undefined || codexLane === undefined) {
      throw new Error('Both paired lanes must complete execution bookkeeping');
    }

    const comparativeVerdict = determineComparativeVerdict(plLane, codexLane, scenarioConfig);
    const admissibility = buildAdmissibility(plLane, codexLane, scenarioConfig);

    await writeRunOutcome(
      runRoot,
      runId,
      options.order,
      plLane,
      codexLane,
      comparativeVerdict,
      admissibility,
      scenarioConfig,
    );
    await writeRunPostmortem(runRoot, runId, plLane, codexLane, admissibility, scenarioConfig);
    await writeRunInterventions(
      runRoot,
      runId,
      plLane,
      codexLane,
      options.documentedHumanInterventions,
      scenarioConfig,
    );
    await writeRunTraceSummary(
      runRoot,
      runId,
      plLane,
      codexLane,
      comparativeVerdict,
      scenarioConfig,
    );
    const scorecard = await writeScorecard(
      runRoot,
      runId,
      plLane,
      codexLane,
      comparativeVerdict,
      admissibility,
      metadata,
      scenarioConfig,
    );

    await updateComparison(
      runId,
      attemptLabel,
      plLane,
      codexLane,
      comparativeVerdict,
      admissibility,
      metadata,
      scenarioConfig,
    );
    await updateAnalysis(runId, attemptLabel, scorecard, metadata, scenarioConfig);

    metadata.endedAt = nowIso();
    metadata.comparativeVerdict = comparativeVerdict;
    metadata.admissibility = admissibility;
    await writeJson(join(runRoot, 'run.json'), metadata);

    completed = true;
    console.log(`[e4:pair] completed ${runId}`);
    console.log(
      `[e4:pair] verdict=${comparativeVerdict} prompt-language=${plLane.manifest.verdict} codex-alone=${codexLane.manifest.verdict}`,
    );
  } catch (error) {
    if (!completed) {
      metadata.endedAt = nowIso();
      metadata.fatalError = error instanceof Error ? error.message : String(error);
      metadata.preservedAsIncomplete = true;
      await writeJson(join(runRoot, 'run.json'), metadata);
      await writeText(
        join(runRoot, 'run-error.txt'),
        `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
      );
      await moveIfExists(runRoot, join(INCOMPLETE_RUNS_ROOT, runId));
      await moveIfExists(workspaceRunRoot, join(INCOMPLETE_WORKSPACES_ROOT, runId));
    }
    throw error;
  } finally {
    if (preparedSeedRoot !== null) {
      await rm(preparedSeedRoot, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(`[e4:pair] FAIL - ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
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
const COMPARISON_PATH = join(RESULTS_ROOT, 'comparison.md');
const ANALYSIS_PATH = join(RESULTS_ROOT, 'analysis-2026-04-12.md');

const SEED_ROOT = join(BOOTSTRAP_ROOT, 'core-proof-seed');
const PL_OVERLAY_ROOT = join(BOOTSTRAP_ROOT, 'pl-overlay');
const CONTROL_FILE = join(CONTROL_ROOT, 'core-proof-sequential.flow');
const PROMPT_FILE = join(CONTROL_ROOT, 'codex-alone-core-proof.prompt.md');

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

function parseArgs(argv) {
  const options = {
    model: DEFAULT_MODEL,
    order: DEFAULT_ORDER,
    runId: null,
    scenario: DEFAULT_SCENARIO,
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
    if (current === '--scenario' && next !== undefined) {
      options.scenario = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument "${current}"`);
  }

  if (!['codex-first', 'pl-first'].includes(options.order)) {
    throw new Error(`--order must be codex-first or pl-first, received "${options.order}"`);
  }

  if (options.scenario !== DEFAULT_SCENARIO) {
    throw new Error(`Only scenario "${DEFAULT_SCENARIO}" is currently implemented`);
  }

  return options;
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

function scoreExperimentalControl(paired, throughputMetricsComplete, traceCompleteness) {
  if (paired && throughputMetricsComplete && traceCompleteness === 'strong') {
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

function scoreRepeatabilityEvidence(paired, throughputMetricsComplete) {
  if (paired && throughputMetricsComplete) {
    return 1;
  }
  return paired ? 1 : 0;
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
  ].join('; ');

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

async function runPromptLanguageLane({
  runId,
  model,
  workspaceRoot,
  laneResultsRoot,
  stateDir,
  bootstrapInfo,
}) {
  await ensureDir(laneResultsRoot);
  await ensureDir(stateDir);
  const requiredArtifacts = requiredArtifactsForLane('pl-sequential');

  const promptStartSnapshot = await captureSystemSnapshot();
  await writeJson(join(laneResultsRoot, 'system-before.json'), promptStartSnapshot);

  const initialSnapshot = await snapshotWorkspaceFiles(workspaceRoot);
  const startedAtMs = Date.now();

  const preflight = runProcess(
    process.execPath,
    [CLI, 'validate', '--runner', 'codex', '--mode', 'headless', '--json', '--file', CONTROL_FILE],
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

  if (preflight.exitCode === 0) {
    mainRun = runProcess(
      process.execPath,
      [
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
        CONTROL_FILE,
      ],
      {
        cwd: workspaceRoot,
        timeoutMs: LANE_TIMEOUT_MS,
        env: {
          PROMPT_LANGUAGE_CODEX_TIMEOUT_MS: String(LANE_TIMEOUT_MS),
          PROMPT_LANGUAGE_CMD_TIMEOUT_MS: String(VERIFICATION_TIMEOUT_MS),
        },
      },
    );
    await writeText(join(laneResultsRoot, 'run-report.json'), safeText(mainRun.stdout, '{}\n'));
    await writeText(
      join(laneResultsRoot, 'run-stderr.log'),
      safeText(mainRun.stderr, '(no stderr)\n'),
    );
    runReport = parseJson(mainRun.stdout.trim());
  } else {
    blockedPreflight = true;
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
    timeToFirstCodeSec,
    interventionCount: 0,
    restartCount: 0,
    runtimeFailureCount,
    failureClass,
    throughputMetricsComplete:
      timeToGreenSec !== null && timeToFirstCodeSec !== null && traceCompleteness === 'strong',
    traceCompleteness,
  };

  const manifest = {
    runId,
    lane: 'pl-sequential',
    candidate: 'prompt-language',
    model,
    status: closure.status,
    verdict: closure.verdict,
    workspaceRoot,
    resultsRoot: laneResultsRoot,
    stateDir,
    controlFile: CONTROL_FILE,
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
        ? 'Prompt-language completed the bounded CRM core and passed all verification commands under the frozen bootstrap seed.'
        : blockedPreflight
          ? 'Prompt-language preflight blocked before execution could start.'
          : 'Prompt-language did not close the bounded CRM core cleanly under the frozen bootstrap seed.',
    traceSummary: {
      primaryTraces: [
        repoRelative(join(stateDir, 'session-state.json')),
        repoRelative(join(stateDir, 'audit.jsonl')),
        repoRelative(join(laneResultsRoot, 'run-report.json')),
      ],
      observations: [
        `preflight status: ${parseJson(preflight.stdout)?.status ?? 'unparsed'}`,
        `run status: ${runReport?.status ?? 'not-run'}`,
        `verification: lint=${verification.lint}, typecheck=${verification.typecheck}, test=${verification.test}`,
      ],
    },
  };
}

async function runCodexLane({ runId, model, workspaceRoot, laneResultsRoot, bootstrapInfo }) {
  await ensureDir(laneResultsRoot);
  const requiredArtifacts = requiredArtifactsForLane('codex-alone');

  const systemBefore = await captureSystemSnapshot();
  await writeJson(join(laneResultsRoot, 'system-before.json'), systemBefore);

  const initialSnapshot = await snapshotWorkspaceFiles(workspaceRoot);
  const promptText = await readText(PROMPT_FILE);
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
  const mainRun = runProcess(command, commandArgs, {
    cwd: workspaceRoot,
    input: promptText,
    timeoutMs: LANE_TIMEOUT_MS,
  });
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
    timeToFirstCodeSec,
    interventionCount: 0,
    restartCount: 0,
    runtimeFailureCount,
    failureClass,
    throughputMetricsComplete:
      timeToGreenSec !== null && timeToFirstCodeSec !== null && traceCompleteness === 'strong',
    traceCompleteness,
  };

  const manifest = {
    runId,
    lane: 'codex-alone',
    candidate: 'codex-alone',
    model,
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
        ? 'Direct Codex completed the bounded CRM core and passed all verification commands under the frozen bootstrap seed.'
        : 'Direct Codex did not close the bounded CRM core cleanly under the frozen bootstrap seed.',
    traceSummary: {
      primaryTraces: [
        repoRelative(join(laneResultsRoot, 'events.jsonl')),
        repoRelative(join(laneResultsRoot, 'stderr.log')),
        repoRelative(lastMessagePath),
      ],
      observations: [
        `main exit code: ${mainRun.exitCode}`,
        `verification: lint=${verification.lint}, typecheck=${verification.typecheck}, test=${verification.test}`,
        `artifacts complete: ${artifacts.complete}`,
      ],
    },
  };
}

function determineComparativeVerdict(plLane, codexLane) {
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

  if (
    plLane.metrics.timeToFirstCodeSec !== null &&
    codexLane.metrics.timeToFirstCodeSec !== null &&
    plLane.metrics.timeToFirstCodeSec !== codexLane.metrics.timeToFirstCodeSec
  ) {
    const firstCodeWinner =
      plLane.metrics.timeToFirstCodeSec < codexLane.metrics.timeToFirstCodeSec
        ? 'prompt-language-better'
        : 'codex-alone-better';
    if (firstCodeWinner !== greenWinner) {
      return 'mixed';
    }
  }

  return greenWinner;
}

function buildAdmissibility(plLane, codexLane) {
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

function buildLaneScores(lane, paired) {
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
    ),
    automationIntegrity: scoreAutomationIntegrity(
      lane.metrics.runtimeFailureCount,
      lane.metrics.restartCount,
      lane.metrics.interventionCount,
    ),
    repeatabilityEvidence: scoreRepeatabilityEvidence(
      paired,
      lane.metrics.throughputMetricsComplete,
    ),
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
    repeatabilityEvidence: [`${prefix}/scorecard.json`],
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
) {
  const content = [
    '# Outcome',
    '',
    `Run: \`${runId}\``,
    `Order: \`${order}\``,
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
    '## Throughput',
    '',
    `- \`prompt-language\` time to green: ${plLane.metrics.timeToGreenSec ?? 'n/a'}s`,
    `- \`prompt-language\` time to first code: ${plLane.metrics.timeToFirstCodeSec ?? 'n/a'}s`,
    `- \`codex-alone\` time to green: ${codexLane.metrics.timeToGreenSec ?? 'n/a'}s`,
    `- \`codex-alone\` time to first code: ${codexLane.metrics.timeToFirstCodeSec ?? 'n/a'}s`,
    `- admissible for throughput claim: ${admissibility.throughputClaimEligible}`,
    '',
    '## Verdict',
    '',
    `- comparative verdict: \`${comparativeVerdict}\``,
    `- admissibility: \`${admissibility.class}\``,
    `- reason: ${admissibility.reason}`,
    '',
  ].join('\n');

  await writeText(join(runRoot, 'outcome.md'), content);
}

async function writeRunPostmortem(runRoot, runId, plLane, codexLane, admissibility) {
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
    '- replicate this paired run at least three times before making a stable superiority claim',
    '- add interruption and resume scenarios only after clean S0 pairs accumulate',
    '',
  ].join('\n');

  await writeText(join(runRoot, 'postmortem.md'), content);
}

async function writeRunInterventions(runRoot, runId, plLane, codexLane) {
  const content = [
    '# Interventions',
    '',
    `Run: \`${runId}\``,
    '',
    '- human interventions: 0',
    '- prompt-language restart count: ' + plLane.metrics.restartCount,
    '- codex-alone restart count: ' + codexLane.metrics.restartCount,
    '- note: this pair was executed end-to-end by the paired harness without manual lane rescue',
    '',
  ].join('\n');

  await writeText(join(runRoot, 'interventions.md'), content);
}

async function writeRunTraceSummary(runRoot, runId, plLane, codexLane, comparativeVerdict) {
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
) {
  const plScoring = buildLaneScores(plLane, true);
  const codexScoring = buildLaneScores(codexLane, true);

  const scorecard = {
    scoreVersion: 'e4-v1',
    runId,
    scope: 'bounded-crm-core',
    question:
      'For the same bounded CRM core slice and frozen bootstrap seed, how does prompt-language compare with direct Codex?',
    baselineReference: 'codex-alone within this run',
    admissibility,
    comparativeVerdict,
    lanes: [
      {
        lane: plLane.manifest.lane,
        candidate: plLane.candidate,
        metrics: {
          timeToGreenSec: plLane.metrics.timeToGreenSec,
          timeToFirstCodeSec: plLane.metrics.timeToFirstCodeSec,
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
        metrics: {
          timeToGreenSec: codexLane.metrics.timeToGreenSec,
          timeToFirstCodeSec: codexLane.metrics.timeToFirstCodeSec,
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
            : 'Both lanes closed the common product contract, but the paired run produced a mixed result: prompt-language reached first code earlier while direct Codex reached green faster.',
    nextExperimentFocus: [
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
) {
  const text = await readText(COMPARISON_PATH);
  const runSection = [
    `### ${attemptLabel}: \`${runId}\``,
    '',
    `- \`prompt-language\` sequential lane: ${plLane.manifest.verdict}`,
    `- direct Codex lane: ${codexLane.manifest.verdict}`,
    '',
    'Meaning:',
    '',
    '- this is the first patched paired clean run driven from the frozen bootstrap seed',
    `- comparative verdict: \`${comparativeVerdict}\``,
    `- throughput admissible: ${admissibility.throughputClaimEligible}`,
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

  const throughputBlock = admissibility.throughputClaimEligible
    ? [
        'Throughput note:',
        '',
        `- \`${attemptLabel}\` is the first paired patched run with lane-appropriate artifact contracts, explicit timings, and complete raw traces`,
        `- provisional raw-throughput verdict: \`${comparativeVerdict}\``,
        '- both lanes closed the same common product contract in this run',
        '- sample size is still `n=1`, so any superiority claim remains provisional until repeated clean pairs agree',
      ].join('\n')
    : [
        'Throughput note:',
        '',
        '- no current run is admissible for a stable throughput-superiority claim',
        `- \`${attemptLabel}\` is paired and timed on the same common product contract, but fixed-order execution means the raw throughput read is still provisional`,
        '- repeat the patched clean pair before making a stronger throughput claim',
      ].join('\n');

  const finalText = updatedText.replace(/Throughput note:\n[\s\S]*$/u, throughputBlock);
  await writeText(COMPARISON_PATH, `${finalText.trim()}\n`);
}

async function updateAnalysis(runId, attemptLabel, scorecard) {
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
    `- comparative verdict: \`${comparativeVerdict}\``,
    `- throughput admissible: ${admissibility.throughputClaimEligible}`,
    `- admissibility reason: ${admissibility.reason}`,
    '',
  ].join('\n');

  await writeText(ANALYSIS_PATH, `${existing.trim()}\n${note}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const attemptNumber = await nextAttemptNumber();
  const attemptLabel = `A${String(attemptNumber).padStart(2, '0')}`;
  const runId =
    options.runId ??
    `${formatRunTimestamp(new Date())}-a${String(attemptNumber).padStart(2, '0')}-core-proof-paired-clean`;

  const runRoot = join(RUNS_ROOT, runId);
  const workspaceRunRoot = join(WORKSPACES_ROOT, runId);
  await ensureDir(runRoot);
  await ensureDir(workspaceRunRoot);

  const seedHash = await computeDirectoryHash(SEED_ROOT);
  const overlayHash = await computeDirectoryHash(PL_OVERLAY_ROOT);
  const controlHash = await computeFileHash(CONTROL_FILE);
  const promptHash = await computeFileHash(PROMPT_FILE);
  const bootstrapInfo = buildBootstrapInfo(seedHash, overlayHash);

  const metadata = {
    runId,
    attemptLabel,
    scenario: options.scenario,
    order: options.order,
    model: options.model,
    startedAt: nowIso(),
    gitCommit: readGitHead(),
    gitStatusShort: readGitStatusShort(),
    nodeVersion: process.version,
    npmVersion: readNpmVersion(),
    codexVersion: readCodexVersion(),
    controlFile: repoRelative(CONTROL_FILE),
    controlHash,
    promptFile: repoRelative(PROMPT_FILE),
    promptHash,
    bootstrapSeed: bootstrapInfo,
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
        });
      } else {
        laneResults.codex = await runCodexLane({
          runId,
          model: options.model,
          workspaceRoot: lane.workspaceRoot,
          laneResultsRoot: lane.resultsRoot,
          bootstrapInfo,
        });
      }
    }

    const plLane = laneResults.pl;
    const codexLane = laneResults.codex;
    if (plLane === undefined || codexLane === undefined) {
      throw new Error('Both paired lanes must complete execution bookkeeping');
    }

    const comparativeVerdict = determineComparativeVerdict(plLane, codexLane);
    const admissibility = buildAdmissibility(plLane, codexLane);

    await writeRunOutcome(
      runRoot,
      runId,
      options.order,
      plLane,
      codexLane,
      comparativeVerdict,
      admissibility,
    );
    await writeRunPostmortem(runRoot, runId, plLane, codexLane, admissibility);
    await writeRunInterventions(runRoot, runId, plLane, codexLane);
    await writeRunTraceSummary(runRoot, runId, plLane, codexLane, comparativeVerdict);
    const scorecard = await writeScorecard(
      runRoot,
      runId,
      plLane,
      codexLane,
      comparativeVerdict,
      admissibility,
    );

    await updateComparison(
      runId,
      attemptLabel,
      plLane,
      codexLane,
      comparativeVerdict,
      admissibility,
    );
    await updateAnalysis(runId, attemptLabel, scorecard);

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
      await rm(runRoot, { recursive: true, force: true });
      await rm(workspaceRunRoot, { recursive: true, force: true });
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

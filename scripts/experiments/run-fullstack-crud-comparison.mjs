#!/usr/bin/env node
// cspell:ignore FSCRUD fscrud noheader

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXPERIMENT_ROOT = join(ROOT, 'experiments', 'fullstack-crud-comparison');
const RESULTS_ROOT = join(ROOT, 'experiments', 'results', 'fullstack-crud-comparison');
const RUN_LOCK_DIR = join(RESULTS_ROOT, '.run.lock');
const TASK_PATH = join(EXPERIMENT_ROOT, 'tasks', 'fscrud-01-field-service-work-orders.md');
const VERIFY_SCRIPT = join(EXPERIMENT_ROOT, 'verification', 'verify-fullstack-crud-workspace.mjs');
const DEFAULT_MODEL = 'ollama_chat/qwen3-opencode:30b';
const DEFAULT_RUNNER = 'aider';
const DEFAULT_LOCAL_RUNNER_TIMEOUT_MS = 600_000;
const DEFAULT_GATE_TIMEOUT_MS = 300_000;
const DEFAULT_OLLAMA_RETRY_ATTEMPTS = 3;
const DEFAULT_OLLAMA_RETRY_DELAY_MS = 1_000;
const DEFAULT_OLLAMA_ACTION_ROUNDS = 8;
const OLLAMA_PS_TIMEOUT_MS = 10_000;
const INSTALL_TIMEOUT_MS = 600_000;
const TEST_TIMEOUT_MS = 300_000;
const VERIFY_TIMEOUT_MS = 360_000;
const RUNNER_ENV_KEYS = [
  'PROMPT_LANGUAGE_AIDER_TIMEOUT_MS',
  'PROMPT_LANGUAGE_OPENCODE_TIMEOUT_MS',
  'PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS',
  'PROMPT_LANGUAGE_OLLAMA_RETRY_ATTEMPTS',
  'PROMPT_LANGUAGE_OLLAMA_RETRY_DELAY_MS',
  'PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS',
  'PROMPT_LANGUAGE_GATE_TIMEOUT_MS',
  'PROMPT_LANGUAGE_OLLAMA_BASE_URL',
  'OLLAMA_API_BASE',
  'PL_TRACE',
  'PL_TRACE_DIR',
  'PL_TRACE_STRICT',
  'FSCRUD_RUNNER',
  'FSCRUD_MODEL',
];
const ARM_FLOWS = {
  'solo-local-crud': join(EXPERIMENT_ROOT, 'flows', 'solo-local-crud.flow'),
  'pl-local-crud-factory': join(EXPERIMENT_ROOT, 'flows', 'pl-fullstack-crud-v1.flow'),
  'pl-local-crud-tight': join(EXPERIMENT_ROOT, 'flows', 'pl-fullstack-crud-tight-v2.flow'),
  'pl-local-crud-tight-v3': join(EXPERIMENT_ROOT, 'flows', 'pl-fullstack-crud-tight-v3.flow'),
  'pl-local-crud-scaffold-contract': join(
    EXPERIMENT_ROOT,
    'flows',
    'pl-fullstack-crud-scaffold-contract-v1.flow',
  ),
  'pl-local-crud-micro-contract': join(
    EXPERIMENT_ROOT,
    'flows',
    'pl-fullstack-crud-micro-contract-v1.flow',
  ),
  'pl-local-crud-micro-contract-v2': join(
    EXPERIMENT_ROOT,
    'flows',
    'pl-fullstack-crud-micro-contract-v2.flow',
  ),
};
const ARM_GROUPS = {
  smoke: ['solo-local-crud', 'pl-local-crud-factory'],
  primary: ['solo-local-crud', 'pl-local-crud-factory'],
  scaffold: ['solo-local-crud', 'pl-local-crud-scaffold-contract'],
  micro: ['solo-local-crud', 'pl-local-crud-micro-contract'],
  'micro-v2': ['solo-local-crud', 'pl-local-crud-micro-contract-v2'],
  tight: ['pl-local-crud-tight-v3'],
  'tight-v2': ['pl-local-crud-tight'],
};

export function parseArgs(argv) {
  const options = {
    arms: 'smoke',
    repeats: 1,
    runner: DEFAULT_RUNNER,
    model: DEFAULT_MODEL,
    runId: timestampId(),
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    const value = argv[index + 1];
    index += 1;
    if (value == null) throw new Error(`${arg} requires a value`);
    if (arg === '--arms') options.arms = value;
    else if (arg === '--repeats') options.repeats = Number.parseInt(value, 10);
    else if (arg === '--runner') options.runner = value;
    else if (arg === '--model') options.model = value;
    else if (arg === '--run-id') options.runId = value;
    else throw new Error(`Unknown option: ${arg}`);
  }

  if (!Number.isInteger(options.repeats) || options.repeats < 1) {
    throw new Error('--repeats must be a positive integer');
  }
  return options;
}

function timestampId() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(
    date.getUTCHours(),
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
}

export function resolveArms(value) {
  const arms =
    ARM_GROUPS[value] ??
    value
      .split(',')
      .map((arm) => arm.trim())
      .filter(Boolean);
  for (const arm of arms) {
    if (!ARM_FLOWS[arm]) throw new Error(`Unknown arm: ${arm}`);
  }
  return arms;
}

function runProcess(command, args, options) {
  const startedAt = new Date();
  const launch = resolveCommand(command, args);
  const result = spawnSync(launch.command, launch.args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    timeout: options.timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  const completedAt = new Date();
  return {
    command,
    args,
    cwd: options.cwd,
    exitCode: result.status ?? (result.signal ? 124 : 1),
    signal: result.signal,
    timedOut: result.error?.code === 'ETIMEDOUT',
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? String(result.error ?? ''),
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
  };
}

function resolveCommand(command, args) {
  if (process.platform === 'win32' && command === 'npm') {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', ['npm', ...args].join(' ')] };
  }
  return { command, args };
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeProcessArtifacts(dir, name, result) {
  writeJson(join(dir, `${name}.json`), result);
  writeFileSync(join(dir, `${name}-stdout.txt`), result.stdout, 'utf8');
  writeFileSync(join(dir, `${name}-stderr.txt`), result.stderr, 'utf8');
}

function artifactRef(name, result) {
  return {
    json: `${name}.json`,
    stdout: `${name}-stdout.txt`,
    stderr: `${name}-stderr.txt`,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    durationMs: result.durationMs,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
  };
}

function gitCommit() {
  const result = runProcess('git', ['rev-parse', 'HEAD'], { cwd: ROOT, timeoutMs: 30_000 });
  return result.exitCode === 0 ? result.stdout.trim() : 'unknown';
}

function gitStatus() {
  const result = runProcess('git', ['status', '--short'], { cwd: ROOT, timeoutMs: 30_000 });
  return result.stdout.trim();
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function modelDigest(model) {
  const ollamaModel = model.startsWith('ollama_chat/')
    ? model.slice('ollama_chat/'.length)
    : model.startsWith('ollama/')
      ? model.slice('ollama/'.length)
      : model;
  const result = runProcess('ollama', ['show', ollamaModel], { cwd: ROOT, timeoutMs: 30_000 });
  const showDigest = result.stdout
    .split(/\r?\n/)
    .find((line) => line.trim().toLowerCase().startsWith('digest'));
  if (result.exitCode === 0 && showDigest) {
    return showDigest.replace(/^digest\s+/i, '').trim();
  }

  const listResult = runProcess('ollama', ['list'], { cwd: ROOT, timeoutMs: 30_000 });
  if (listResult.exitCode !== 0) return null;
  const listLine = listResult.stdout
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith(`${ollamaModel} `));
  return listLine?.trim().split(/\s+/)[1] ?? null;
}

function readHardware() {
  const nvidia = runProcess(
    'nvidia-smi',
    [
      '--query-gpu=name,utilization.gpu,memory.used,memory.total,driver_version',
      '--format=csv,noheader',
    ],
    { cwd: ROOT, timeoutMs: 10_000 },
  );
  if (nvidia.exitCode === 0) return { source: 'nvidia-smi', raw: nvidia.stdout.trim() };

  const amd = runProcess(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      'Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion | ConvertTo-Json -Compress',
    ],
    { cwd: ROOT, timeoutMs: 10_000 },
  );
  return amd.exitCode === 0
    ? { source: 'Win32_VideoController', raw: amd.stdout.trim() }
    : { source: 'unavailable', raw: '' };
}

function prepareAttempt(attemptDir) {
  rmSync(attemptDir, { recursive: true, force: true });
  mkdirSync(attemptDir, { recursive: true });
  cpSync(TASK_PATH, join(attemptDir, 'TASK.md'));
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function runnerEnv(options) {
  return {
    ...process.env,
    PROMPT_LANGUAGE_AIDER_TIMEOUT_MS:
      process.env.PROMPT_LANGUAGE_AIDER_TIMEOUT_MS ?? String(DEFAULT_LOCAL_RUNNER_TIMEOUT_MS),
    PROMPT_LANGUAGE_OPENCODE_TIMEOUT_MS:
      process.env.PROMPT_LANGUAGE_OPENCODE_TIMEOUT_MS ?? String(DEFAULT_LOCAL_RUNNER_TIMEOUT_MS),
    PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS:
      process.env.PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS ?? String(DEFAULT_LOCAL_RUNNER_TIMEOUT_MS),
    PROMPT_LANGUAGE_OLLAMA_RETRY_ATTEMPTS:
      process.env.PROMPT_LANGUAGE_OLLAMA_RETRY_ATTEMPTS ?? String(DEFAULT_OLLAMA_RETRY_ATTEMPTS),
    PROMPT_LANGUAGE_OLLAMA_RETRY_DELAY_MS:
      process.env.PROMPT_LANGUAGE_OLLAMA_RETRY_DELAY_MS ?? String(DEFAULT_OLLAMA_RETRY_DELAY_MS),
    PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS:
      process.env.PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS ?? String(DEFAULT_OLLAMA_ACTION_ROUNDS),
    PROMPT_LANGUAGE_GATE_TIMEOUT_MS:
      process.env.PROMPT_LANGUAGE_GATE_TIMEOUT_MS ?? String(DEFAULT_GATE_TIMEOUT_MS),
    PL_TRACE: process.env.PL_TRACE ?? '1',
    FSCRUD_RUNNER: options.runner,
    FSCRUD_MODEL: options.model,
  };
}

function runnerEnvSnapshot(options) {
  const env = runnerEnv(options);
  return Object.fromEntries(RUNNER_ENV_KEYS.map((key) => [key, env[key] ?? null]));
}

export function isOllamaBackedRun(options) {
  return (
    options.runner === 'ollama' ||
    options.model.startsWith('ollama/') ||
    options.model.startsWith('ollama_chat/')
  );
}

export function classifyRunOutcome(summary) {
  if (summary.skipped) return 'dry_run_skipped';
  if (summary.runnerTimedOut) return 'timeout_partial';
  if (summary.runnerExitCode !== 0) return 'flow_failed';
  return summary.verifierPassed ? 'verified_pass' : 'verifier_failed';
}

function collectOllamaPsSnapshot(attemptDir, phase, options) {
  if (!isOllamaBackedRun(options)) return null;

  const artifactName = `ollama-ps-${phase}`;
  const result = runProcess('ollama', ['ps'], {
    cwd: ROOT,
    env: process.env,
    timeoutMs: OLLAMA_PS_TIMEOUT_MS,
  });
  writeProcessArtifacts(attemptDir, artifactName, result);
  return artifactRef(artifactName, result);
}

function runArm(context) {
  const attemptDir = join(context.repeatDir, `${context.position}-${context.arm}`);
  const stateDir = join(attemptDir, '.prompt-language');
  const workspace = join(attemptDir, 'workspace', 'fscrud-01');
  prepareAttempt(attemptDir);

  if (context.options.dryRun) {
    writeJson(join(attemptDir, 'run-manifest.json'), manifestBase(context, attemptDir, workspace));
    const summary = { arm: context.arm, skipped: true, verifierPassed: null };
    return { ...summary, outcome: classifyRunOutcome(summary) };
  }

  const runnerEnvironment = runnerEnv(context.options);
  const ollamaPsBeforeRunner = collectOllamaPsSnapshot(
    attemptDir,
    'before-runner',
    context.options,
  );
  const runResult = runProcess(
    process.execPath,
    [
      join(ROOT, 'bin', 'cli.mjs'),
      'run',
      '--runner',
      context.options.runner,
      '--model',
      context.options.model,
      '--json',
      '--state-dir',
      stateDir,
      '--file',
      ARM_FLOWS[context.arm],
    ],
    { cwd: attemptDir, env: runnerEnvironment, timeoutMs: wallTimeoutMs(context.arm) },
  );
  writeProcessArtifacts(attemptDir, 'runner', runResult);
  const ollamaPsAfterRunner = collectOllamaPsSnapshot(attemptDir, 'after-runner', context.options);

  const runnerSucceeded = runResult.exitCode === 0;
  const packageExists = existsSync(join(workspace, 'package.json'));
  const installResult =
    runnerSucceeded && packageExists
      ? runProcess('npm', ['install'], {
          cwd: workspace,
          env: process.env,
          timeoutMs: INSTALL_TIMEOUT_MS,
        })
      : skippedProcess(
          'npm',
          ['install'],
          workspace,
          runnerSucceeded ? 'package.json missing' : 'runner failed',
        );
  writeProcessArtifacts(attemptDir, 'install', installResult);

  const testResult =
    runnerSucceeded && packageExists
      ? runProcess('npm', ['test'], {
          cwd: workspace,
          env: process.env,
          timeoutMs: TEST_TIMEOUT_MS,
        })
      : skippedProcess(
          'npm',
          ['test'],
          workspace,
          runnerSucceeded ? 'package.json missing' : 'runner failed',
        );
  writeProcessArtifacts(attemptDir, 'test', testResult);

  const verifyArgs = [VERIFY_SCRIPT, '--workspace', workspace, '--json'];
  if (!runnerSucceeded) {
    verifyArgs.push('--no-run-tests');
  }
  const verifyResult = runProcess(process.execPath, verifyArgs, {
    cwd: ROOT,
    env: process.env,
    timeoutMs: VERIFY_TIMEOUT_MS,
  });
  writeProcessArtifacts(attemptDir, 'verifier', verifyResult);

  const manifest = {
    ...manifestBase(context, attemptDir, workspace, {
      ollamaPsBeforeRunner,
      ollamaPsAfterRunner,
    }),
    runnerExitCode: runResult.exitCode,
    installExitCode: installResult.exitCode,
    testExitCode: testResult.exitCode,
    verifierExitCode: verifyResult.exitCode,
    completedAt: new Date().toISOString(),
  };
  writeJson(join(attemptDir, 'run-manifest.json'), manifest);
  const summary = {
    arm: context.arm,
    skipped: false,
    runnerExitCode: runResult.exitCode,
    runnerTimedOut: runResult.timedOut,
    verifierPassed: verifyResult.exitCode === 0,
  };
  return { ...summary, outcome: classifyRunOutcome(summary) };
}

function wallTimeoutMs(arm) {
  return arm === 'solo-local-crud' ? 90 * 60_000 : 150 * 60_000;
}

function skippedProcess(command, args, cwd, reason) {
  const now = new Date().toISOString();
  return {
    command,
    args,
    cwd,
    exitCode: 1,
    signal: null,
    timedOut: false,
    stdout: '',
    stderr: reason,
    startedAt: now,
    completedAt: now,
    durationMs: 0,
  };
}

function timeoutDetails(context) {
  const env = runnerEnv(context.options);
  return {
    soloWallClockMinutes: 90,
    plWallClockMinutes: 150,
    runnerWallClockMs: wallTimeoutMs(context.arm),
    runnerWallClockMinutes: wallTimeoutMs(context.arm) / 60_000,
    aiderTurnMs: parsePositiveInt(
      env.PROMPT_LANGUAGE_AIDER_TIMEOUT_MS,
      DEFAULT_LOCAL_RUNNER_TIMEOUT_MS,
    ),
    opencodeTurnMs: parsePositiveInt(
      env.PROMPT_LANGUAGE_OPENCODE_TIMEOUT_MS,
      DEFAULT_LOCAL_RUNNER_TIMEOUT_MS,
    ),
    ollamaTurnMs: parsePositiveInt(
      env.PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS,
      DEFAULT_LOCAL_RUNNER_TIMEOUT_MS,
    ),
    gateMs: parsePositiveInt(env.PROMPT_LANGUAGE_GATE_TIMEOUT_MS, DEFAULT_GATE_TIMEOUT_MS),
    installMs: INSTALL_TIMEOUT_MS,
    testMs: TEST_TIMEOUT_MS,
    verifierMs: VERIFY_TIMEOUT_MS,
    ollamaPsMs: OLLAMA_PS_TIMEOUT_MS,
    modelTurnSeconds: 600,
    commandSeconds: 300,
  };
}

function retryDetails(options) {
  const env = runnerEnv(options);
  return {
    ollamaAttempts: parsePositiveInt(
      env.PROMPT_LANGUAGE_OLLAMA_RETRY_ATTEMPTS,
      DEFAULT_OLLAMA_RETRY_ATTEMPTS,
    ),
    ollamaDelayMs: parsePositiveInt(
      env.PROMPT_LANGUAGE_OLLAMA_RETRY_DELAY_MS,
      DEFAULT_OLLAMA_RETRY_DELAY_MS,
    ),
    ollamaActionRounds: parsePositiveInt(
      env.PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS,
      DEFAULT_OLLAMA_ACTION_ROUNDS,
    ),
  };
}

function runtimeDetails(context) {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    host: hostname(),
    pid: process.pid,
    execPath: process.execPath,
    ollamaBacked: isOllamaBackedRun(context.options),
    experimentLock: context.experimentLock ?? null,
  };
}

export function manifestBase(context, attemptDir, workspace, runtimeArtifacts = {}) {
  return {
    experimentId: 'FSCRUD-01',
    arm: context.arm,
    repeatId: context.repeatId,
    runner: context.options.runner,
    model: context.options.model,
    modelDigest: context.modelDigest,
    repoCommit: context.repoCommit,
    repoStatusAtStart: context.repoStatusAtStart,
    taskSha256: context.taskSha256,
    flow: relative(ROOT, ARM_FLOWS[context.arm]).replaceAll('\\', '/'),
    attemptDir: relative(ROOT, attemptDir).replaceAll('\\', '/'),
    workspace: relative(ROOT, workspace).replaceAll('\\', '/'),
    hardware: context.hardware,
    timeouts: timeoutDetails(context),
    retries: retryDetails(context.options),
    environment: runnerEnvSnapshot(context.options),
    runtime: runtimeDetails(context),
    runtimeArtifacts: {
      ollamaPsBeforeRunner: runtimeArtifacts.ollamaPsBeforeRunner ?? null,
      ollamaPsAfterRunner: runtimeArtifacts.ollamaPsAfterRunner ?? null,
    },
    runtimeIsPrimaryScore: false,
    createdAt: new Date().toISOString(),
  };
}

export function createExperimentLock(options, lockPath = RUN_LOCK_DIR) {
  mkdirSync(dirname(lockPath), { recursive: true });

  const metadata = {
    runId: options.runId,
    runner: options.runner,
    model: options.model,
    pid: process.pid,
    host: hostname(),
    startedAt: new Date().toISOString(),
    cwd: ROOT,
    lockPath: relative(ROOT, lockPath).replaceAll('\\', '/'),
  };

  try {
    mkdirSync(lockPath);
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : undefined;
    if (code !== 'EEXIST') throw error;

    const ownerPath = join(lockPath, 'owner.json');
    const owner = existsSync(ownerPath) ? readFileSync(ownerPath, 'utf8').trim() : 'unknown owner';
    throw new Error(
      [
        'Another FSCRUD experiment appears to be running.',
        `Lock: ${relative(ROOT, lockPath).replaceAll('\\', '/')}`,
        `Owner: ${owner}`,
        'If this is stale, remove the lock directory after confirming no run is active.',
      ].join('\n'),
    );
  }

  writeJson(join(lockPath, 'owner.json'), metadata);
  return { path: lockPath, metadata };
}

export function releaseExperimentLock(lock) {
  rmSync(lock.path, { recursive: true, force: true });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const arms = resolveArms(options.arms);
  const lock = createExperimentLock(options);

  try {
    const runRoot = join(RESULTS_ROOT, options.runId);
    mkdirSync(runRoot, { recursive: true });

    const shared = {
      options,
      modelDigest: modelDigest(options.model),
      repoCommit: gitCommit(),
      repoStatusAtStart: gitStatus(),
      taskSha256: sha256File(TASK_PATH),
      hardware: readHardware(),
      experimentLock: lock.metadata,
    };
    const summaries = [];

    for (let repeat = 1; repeat <= options.repeats; repeat += 1) {
      const repeatId = `r${String(repeat).padStart(2, '0')}`;
      const repeatDir = join(runRoot, repeatId);
      mkdirSync(repeatDir, { recursive: true });
      writeJson(join(repeatDir, 'arm-order.json'), { arms });

      arms.forEach((arm, index) => {
        console.log(`[fscrud] ${repeatId} ${index + 1}/${arms.length} ${arm}`);
        summaries.push(
          runArm({
            ...shared,
            arm,
            repeatId,
            repeatDir,
            position: String(index + 1).padStart(2, '0'),
          }),
        );
      });
    }

    writeJson(join(runRoot, 'summary.json'), {
      runId: options.runId,
      arms,
      repeats: options.repeats,
      runner: options.runner,
      model: options.model,
      dryRun: options.dryRun,
      timeouts: timeoutDetails({ arm: arms[0], options }),
      retries: retryDetails(options),
      environment: runnerEnvSnapshot(options),
      runtime: runtimeDetails({ options, experimentLock: lock.metadata }),
      summaries,
    });
    console.log(`[fscrud] results: ${relative(ROOT, runRoot).replaceAll('\\', '/')}`);
  } finally {
    releaseExperimentLock(lock);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

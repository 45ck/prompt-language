#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXPERIMENT_ROOT = join(ROOT, 'experiments', 'fullstack-crud-comparison');
const RESULTS_ROOT = join(ROOT, 'experiments', 'results', 'fullstack-crud-comparison');
const TASK_PATH = join(EXPERIMENT_ROOT, 'tasks', 'fscrud-01-field-service-work-orders.md');
const VERIFY_SCRIPT = join(EXPERIMENT_ROOT, 'verification', 'verify-fullstack-crud-workspace.mjs');
const DEFAULT_MODEL = 'ollama_chat/qwen3-opencode:30b';
const DEFAULT_RUNNER = 'aider';
const ARM_FLOWS = {
  'solo-local-crud': join(EXPERIMENT_ROOT, 'flows', 'solo-local-crud.flow'),
  'pl-local-crud-factory': join(EXPERIMENT_ROOT, 'flows', 'pl-fullstack-crud-v1.flow'),
  'pl-local-crud-tight': join(EXPERIMENT_ROOT, 'flows', 'pl-fullstack-crud-tight-v2.flow'),
  'pl-local-crud-tight-v3': join(EXPERIMENT_ROOT, 'flows', 'pl-fullstack-crud-tight-v3.flow'),
};
const ARM_GROUPS = {
  smoke: ['solo-local-crud', 'pl-local-crud-factory'],
  primary: ['solo-local-crud', 'pl-local-crud-factory'],
  tight: ['pl-local-crud-tight-v3'],
  'tight-v2': ['pl-local-crud-tight'],
};

function parseArgs(argv) {
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

function resolveArms(value) {
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
  if (result.exitCode !== 0) return null;
  const digest = result.stdout
    .split(/\r?\n/)
    .find((line) => line.trim().toLowerCase().startsWith('digest'));
  return digest?.replace(/^digest\s+/i, '').trim() ?? null;
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

function runnerEnv(options) {
  return {
    ...process.env,
    PROMPT_LANGUAGE_AIDER_TIMEOUT_MS: process.env.PROMPT_LANGUAGE_AIDER_TIMEOUT_MS ?? '600000',
    PROMPT_LANGUAGE_OPENCODE_TIMEOUT_MS:
      process.env.PROMPT_LANGUAGE_OPENCODE_TIMEOUT_MS ?? '600000',
    PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS: process.env.PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS ?? '600000',
    PROMPT_LANGUAGE_GATE_TIMEOUT_MS: process.env.PROMPT_LANGUAGE_GATE_TIMEOUT_MS ?? '300000',
    PL_TRACE: process.env.PL_TRACE ?? '1',
    FSCRUD_RUNNER: options.runner,
    FSCRUD_MODEL: options.model,
  };
}

function runArm(context) {
  const attemptDir = join(context.repeatDir, `${context.position}-${context.arm}`);
  const stateDir = join(attemptDir, '.prompt-language');
  const workspace = join(attemptDir, 'workspace', 'fscrud-01');
  prepareAttempt(attemptDir);

  if (context.options.dryRun) {
    writeJson(join(attemptDir, 'run-manifest.json'), manifestBase(context, attemptDir, workspace));
    return { arm: context.arm, skipped: true, verifierPassed: null };
  }

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
    { cwd: attemptDir, env: runnerEnv(context.options), timeoutMs: wallTimeoutMs(context.arm) },
  );
  writeProcessArtifacts(attemptDir, 'runner', runResult);

  const installResult = existsSync(join(workspace, 'package.json'))
    ? runProcess('npm', ['install'], { cwd: workspace, env: process.env, timeoutMs: 600_000 })
    : skippedProcess('npm', ['install'], workspace, 'package.json missing');
  writeProcessArtifacts(attemptDir, 'install', installResult);

  const testResult = existsSync(join(workspace, 'package.json'))
    ? runProcess('npm', ['test'], { cwd: workspace, env: process.env, timeoutMs: 300_000 })
    : skippedProcess('npm', ['test'], workspace, 'package.json missing');
  writeProcessArtifacts(attemptDir, 'test', testResult);

  const verifyResult = runProcess(
    process.execPath,
    [VERIFY_SCRIPT, '--workspace', workspace, '--json'],
    { cwd: ROOT, env: process.env, timeoutMs: 360_000 },
  );
  writeProcessArtifacts(attemptDir, 'verifier', verifyResult);

  const manifest = {
    ...manifestBase(context, attemptDir, workspace),
    runnerExitCode: runResult.exitCode,
    installExitCode: installResult.exitCode,
    testExitCode: testResult.exitCode,
    verifierExitCode: verifyResult.exitCode,
    completedAt: new Date().toISOString(),
  };
  writeJson(join(attemptDir, 'run-manifest.json'), manifest);
  return {
    arm: context.arm,
    skipped: false,
    runnerExitCode: runResult.exitCode,
    verifierPassed: verifyResult.exitCode === 0,
  };
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

function manifestBase(context, attemptDir, workspace) {
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
    timeouts: {
      soloWallClockMinutes: 90,
      plWallClockMinutes: 150,
      modelTurnSeconds: 600,
      commandSeconds: 300,
    },
    runtimeIsPrimaryScore: false,
    createdAt: new Date().toISOString(),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const arms = resolveArms(options.arms);
  const runRoot = join(RESULTS_ROOT, options.runId);
  mkdirSync(runRoot, { recursive: true });

  const shared = {
    options,
    modelDigest: modelDigest(options.model),
    repoCommit: gitCommit(),
    repoStatusAtStart: gitStatus(),
    taskSha256: sha256File(TASK_PATH),
    hardware: readHardware(),
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
    summaries,
  });
  console.log(`[fscrud] results: ${relative(ROOT, runRoot).replaceAll('\\', '/')}`);
}

main();

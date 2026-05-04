#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const SCHEMA = JSON.parse(readFileSync(join(HERE, 'hybrid-routing-manifest.schema.json'), 'utf8'));
const DEFAULT_OUTPUT_ROOT = join(ROOT, 'experiments', 'results', 'harness-arena');
const ALL_ARMS = ['local-only', 'frontier-only', 'advisor-only', 'hybrid-router'];
const DEFAULT_ORACLE_COMMAND = 'node private/ha-hr1-oracle.mjs --workspace <workspace>';
const DEFAULT_STEP_TIMEOUT_MS = 1_000;
const DEFAULT_ORACLE_TIMEOUT_MS = 1_000;
const DEFAULT_TASK_BRIEF =
  'Synthetic HA-HR1 structure check. Prepare isolated arm workspaces only.';
const DRY_RUN_NOTE = `# Harness Arena Dry Run

This directory exists to validate arm/workspace materialization.
It is not evidence of model quality or task completion.
`;
const FAKE_LIVE_NOTE = `# Harness Arena Fake Live Run

This directory is exercised by deterministic local commands only.
No local or frontier LLM has been invoked.
`;
const ARG_FIELDS = {
  '--arms': 'arms',
  '--fake-step-command': 'fakeStepCommand',
  '--fixture': 'fixture',
  '--oracle-command': 'oracleCommand',
  '--oracle-timeout-ms': 'oracleTimeoutMs',
  '--output-root': 'outputRoot',
  '--policy-version': 'policyVersion',
  '--run-id': 'runId',
  '--started-at': 'startedAt',
  '--step-timeout-ms': 'stepTimeoutMs',
  '--task-brief': 'taskBrief',
  '--task-id': 'taskId',
};
const ARM_STEPS = {
  'local-only': [['local-bulk', 'local', 'local-only control arm']],
  'frontier-only': [['frontier-full', 'frontier', 'control arm']],
  'advisor-only': [
    ['frontier-advice', 'frontier', 'advisor baseline'],
    ['local-apply', 'local', 'advisor baseline'],
  ],
  'hybrid-router': [
    ['frontier-classify', 'frontier', 'risk classifier'],
    ['local-bulk', 'local', 'local-first policy'],
    ['frontier-review', 'frontier', 'final review gate'],
  ],
};

export function parseArgs(argv) {
  const options = {
    arms: 'all',
    fakeStepCommand: null,
    fixture: null,
    mode: 'dry-run',
    oracleCommand: DEFAULT_ORACLE_COMMAND,
    oracleTimeoutMs: DEFAULT_ORACLE_TIMEOUT_MS,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    policyVersion: 'hybrid-routing-v0',
    runId: null,
    startedAt: null,
    stepTimeoutMs: DEFAULT_STEP_TIMEOUT_MS,
    taskBrief: DEFAULT_TASK_BRIEF,
    taskId: 'HA-HR1-synthetic',
  };
  let explicitMode = false;
  let oracleCommandProvided = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') return { help: true };
    if (arg === '--dry-run') {
      setMode(options, 'dry-run', explicitMode);
      explicitMode = true;
      continue;
    }
    if (arg === '--fake-live') {
      setMode(options, 'fake-live', explicitMode);
      explicitMode = true;
      continue;
    }
    if (arg === '--live') {
      throw new Error('live HA-HR1 model execution is not implemented; use --fake-live');
    }
    const field = ARG_FIELDS[arg];
    const value = argv[index + 1];
    if (!field) throw new Error(`Unknown option: ${arg}`);
    if (value == null) throw new Error(`${arg} requires a value`);
    if (field === 'oracleCommand') oracleCommandProvided = true;
    options[field] =
      field === 'oracleTimeoutMs' || field === 'stepTimeoutMs'
        ? parsePositiveInteger(value, arg)
        : value;
    index += 1;
  }

  if (options.mode === 'fake-live' && !oracleCommandProvided) {
    options.oracleCommand = defaultFakeOracleCommand();
  }

  return {
    ...options,
    arms: resolveArms(options.arms),
    fixture: options.fixture ? resolve(options.fixture) : null,
    outputRoot: resolve(options.outputRoot),
    runId: options.runId ?? timestampId(),
    startedAt: options.startedAt ?? new Date().toISOString(),
  };
}

function setMode(options, nextMode, explicitMode) {
  if (explicitMode && options.mode !== nextMode) {
    throw new Error(`conflicting modes: ${options.mode} and ${nextMode}`);
  }
  options.mode = nextMode;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== value) {
    throw new Error(`${flag} requires a positive integer`);
  }
  return parsed;
}

export function resolveArms(value) {
  const arms =
    value === 'all'
      ? ALL_ARMS
      : value
          .split(',')
          .map((arm) => arm.trim())
          .filter(Boolean);
  for (const arm of arms) {
    if (!ALL_ARMS.includes(arm)) throw new Error(`Unknown arm: ${arm}`);
  }
  if (arms.length === 0) throw new Error('at least one arm is required');
  return arms;
}

export function runHarnessArena(options) {
  const runRoot = join(options.outputRoot, options.runId);
  ensureFreshDirectory(runRoot);
  const armRuns = options.arms.map((arm, index) => materializeArm(options, runRoot, arm, index));
  writeJson(join(runRoot, 'summary.json'), {
    mode: options.mode,
    runId: options.runId,
    taskId: options.taskId,
    arms: options.arms,
    manifests: armRuns.map((run) => relative(runRoot, run.manifestPath).replaceAll('\\', '/')),
    claimStatus:
      options.mode === 'fake-live'
        ? 'fake-live-deterministic-not-model-evidence'
        : 'structure-only-not-model-evidence',
  });
  return { runRoot, armRuns };
}

function materializeArm(options, runRoot, arm, index) {
  const armDir = join(runRoot, `${String(index + 1).padStart(2, '0')}-${arm}`);
  const workspace = join(armDir, 'workspace');
  const privateDir = join(armDir, 'private');
  mkdirSync(privateDir, { recursive: true });
  mkdirSync(workspace, { recursive: true });
  prepareWorkspace(workspace, options);
  const stepExecutions =
    options.mode === 'fake-live' ? executeFakeLiveSteps(options, armDir, arm, workspace) : null;
  writeJson(join(armDir, 'arm-plan.json'), {
    mode: options.mode,
    arm,
    taskId: options.taskId,
    workspace,
    plannedSteps: ARM_STEPS[arm].map(([stepId]) => stepId),
    claimStatus:
      options.mode === 'fake-live'
        ? 'fake-live-deterministic-not-model-evidence'
        : 'structure-only-not-model-evidence',
  });
  writeFileSync(join(privateDir, 'oracle-command.txt'), `${options.oracleCommand}\n`, 'utf8');
  assertNoOracleLeak(workspace, options.oracleCommand);
  const oracleExecution =
    options.mode === 'fake-live' ? executePrivateOracle(options, armDir, workspace) : null;
  assertNoOracleLeak(workspace, options.oracleCommand);
  const manifest = buildManifest(options, arm, workspace, stepExecutions, oracleExecution);
  const validation = validateManifestAgainstSchema(manifest);
  if (!validation.valid) throw new Error(`manifest invalid: ${validation.errors.join('; ')}`);
  const manifestPath = join(armDir, 'hybrid-routing-manifest.json');
  writeJson(manifestPath, manifest);
  return { arm, armDir, manifestPath, workspace };
}

function prepareWorkspace(workspace, options) {
  if (options.fixture) copyModelVisibleFixture(options.fixture, workspace);
  else writeFileSync(join(workspace, 'TASK.md'), syntheticTask(options), 'utf8');
  const noteFile =
    options.mode === 'fake-live' ? 'HARNESS-ARENA-FAKE-LIVE.md' : 'HARNESS-ARENA-DRY-RUN.md';
  const note = options.mode === 'fake-live' ? FAKE_LIVE_NOTE : DRY_RUN_NOTE;
  writeFileSync(join(workspace, noteFile), note, 'utf8');
}

function syntheticTask(options) {
  return `# HA-HR1 Synthetic Task

Task ID: ${options.taskId}

${options.taskBrief}

This workspace is model-visible input for a dry run only.
No local or frontier model has been invoked.
`;
}

export function copyModelVisibleFixture(fixtureRoot, workspace) {
  if (!existsSync(fixtureRoot) || !statSync(fixtureRoot).isDirectory()) {
    throw new Error(`fixture directory not found: ${fixtureRoot}`);
  }
  for (const relativeFile of listModelVisibleFixtureFiles(fixtureRoot)) {
    const source = join(fixtureRoot, ...relativeFile.split('/'));
    const target = join(workspace, ...relativeFile.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(source));
  }
}

export function listModelVisibleFixtureFiles(fixtureRoot) {
  const files = [];
  collectFiles(fixtureRoot, '', files);
  return files.filter(isModelVisibleFixtureFile).sort();
}

function collectFiles(dir, prefix, files) {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort(byName)) {
    const next = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(absolute, next, files);
    else if (entry.isFile()) files.push(next);
  }
}

function isModelVisibleFixtureFile(relativeFile) {
  const parts = relativeFile.split('/');
  return (
    !parts.some(isBlockedSegment) &&
    (['TASK.md', 'README.md', 'package.json', 'package-lock.json'].includes(relativeFile) ||
      ['src', 'test', 'tests'].includes(parts[0]))
  );
}

function isBlockedSegment(segment) {
  const lower = segment.toLowerCase();
  return (
    lower === '.git' ||
    lower === 'node_modules' ||
    lower.includes('oracle') ||
    lower.includes('verifier') ||
    lower.includes('verification')
  );
}

function executeFakeLiveSteps(options, armDir, arm, workspace) {
  return ARM_STEPS[arm].map(([stepId], index) => {
    const command = buildFakeStepCommand(options, arm, stepId, index, workspace);
    const artifactDir = join(armDir, 'artifacts', 'steps', stepArtifactDirectory(index, stepId));
    return executeCommandPhase({
      artifactDir,
      armDir,
      command,
      cwd: workspace,
      phase: 'step',
      timeoutMs: options.stepTimeoutMs,
    });
  });
}

function executePrivateOracle(options, armDir, workspace) {
  const command = commandFromTemplate(options.oracleCommand, { workspace });
  const artifactDir = join(armDir, 'private', 'oracle');
  return executeCommandPhase({
    artifactDir,
    armDir,
    command,
    cwd: artifactDir,
    phase: 'oracle',
    timeoutMs: options.oracleTimeoutMs,
  });
}

function executeCommandPhase({ artifactDir, armDir, command, cwd, phase, timeoutMs }) {
  mkdirSync(artifactDir, { recursive: true });
  const execution = runCommandWithTimeout({ ...command, cwd, timeoutMs });
  const stdoutPath = join(artifactDir, 'stdout.txt');
  const stderrPath = join(artifactDir, 'stderr.txt');
  const metadataPath = join(artifactDir, 'metadata.json');
  writeFileSync(stdoutPath, execution.stdout, 'utf8');
  writeFileSync(stderrPath, execution.stderr, 'utf8');
  writeJson(metadataPath, {
    phase,
    command: command.displayCommand,
    timeoutMs,
    timedOut: execution.timedOut,
    exitCode: execution.exitCode,
    signal: execution.signal,
    wallSeconds: execution.wallSeconds,
    durationMs: execution.durationMs,
    error: execution.error,
  });
  return {
    ...execution,
    metadataArtifactRef: artifactRef(armDir, metadataPath),
    stderrArtifactRef: artifactRef(armDir, stderrPath),
    stdoutArtifactRef: artifactRef(armDir, stdoutPath),
    timeoutMs,
  };
}

export function runCommandWithTimeout({ args = [], command, cwd, timeoutMs }) {
  const startedAt = new Date().toISOString();
  const started = process.hrtime.bigint();
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    killSignal: 'SIGTERM',
    timeout: timeoutMs,
    windowsHide: true,
  });
  const durationMs = Math.round(Number(process.hrtime.bigint() - started) / 1_000_000);
  const timedOut = result.error?.code === 'ETIMEDOUT';

  return {
    completedAt: new Date().toISOString(),
    durationMs,
    error: result.error ? String(result.error.message) : null,
    exitCode: typeof result.status === 'number' ? result.status : null,
    signal: result.signal ?? null,
    startedAt,
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    timedOut,
    wallSeconds: Number((durationMs / 1_000).toFixed(3)),
  };
}

function buildFakeStepCommand(options, arm, stepId, index, workspace) {
  if (options.fakeStepCommand) {
    return commandFromTemplate(options.fakeStepCommand, {
      arm,
      stepId,
      workspace,
    });
  }

  return {
    args: [
      '-e',
      [
        'const [arm, stepId, attempt] = process.argv.slice(1);',
        'console.log(`fake-live:${arm}:${stepId}:${attempt}`);',
        'console.error(`fake-live-stderr:${stepId}`);',
      ].join(' '),
      arm,
      stepId,
      String(index + 1),
    ],
    command: process.execPath,
    displayCommand: 'node -e <harness-arena fake step>',
  };
}

function commandFromTemplate(template, replacements) {
  const interpolated = interpolateCommandTemplate(template, replacements);
  const [command, ...args] = splitCommandLine(interpolated);
  return { args, command, displayCommand: interpolated };
}

function interpolateCommandTemplate(template, replacements) {
  let interpolated = template;
  for (const [key, value] of Object.entries(replacements)) {
    interpolated = interpolated.replaceAll(`<${key}>`, quoteCommandArg(value));
  }
  return interpolated;
}

export function splitCommandLine(commandLine) {
  const tokens = [];
  let current = '';
  let quote = null;

  for (let index = 0; index < commandLine.length; index += 1) {
    const char = commandLine[index];
    if (quote) {
      if (char === '\\' && commandLine[index + 1] === quote) {
        current += quote;
        index += 1;
      } else if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (quote) throw new Error('unterminated quote in command');
  if (current) tokens.push(current);
  if (tokens.length === 0) throw new Error('command is empty');
  return tokens;
}

function quoteCommandArg(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`;
}

function defaultFakeOracleCommand() {
  const script = [
    "const fs = require('node:fs');",
    'const workspace = process.argv[1];',
    "if (!fs.existsSync(workspace)) { console.error('workspace missing'); process.exit(1); }",
    "console.log('fake oracle pass');",
  ].join(' ');
  return `${quoteCommandArg(process.execPath)} -e ${quoteCommandArg(script)} <workspace>`;
}

function buildManifest(options, arm, workspace, stepExecutions = null, oracleExecution = null) {
  return {
    schemaVersion: 2,
    policyVersion: options.policyVersion,
    runId: options.runId,
    taskId: options.taskId,
    arm,
    startedAt: options.startedAt,
    completedAt: options.startedAt,
    budget: { frontierCallLimit: 0, usdLimit: 0, wallSecondsLimit: 1 },
    steps: ARM_STEPS[arm].map((step, index) =>
      buildStep(step, index, options, workspace, stepExecutions?.[index] ?? null),
    ),
    oracle: buildOracle(options, oracleExecution),
    classification: buildClassification(options, stepExecutions, oracleExecution),
  };
}

function buildOracle(options, oracleExecution) {
  if (!oracleExecution) {
    return {
      command: options.oracleCommand,
      exitCode: null,
      passed: false,
      summary: 'Dry-run structure validation only; no task oracle was executed.',
    };
  }

  return {
    command: options.oracleCommand,
    exitCode: oracleExecution.exitCode,
    passed: oracleExecution.exitCode === 0 && !oracleExecution.timedOut,
    stderrArtifactRef: oracleExecution.stderrArtifactRef,
    stdoutArtifactRef: oracleExecution.stdoutArtifactRef,
    summary: oracleExecution.timedOut
      ? `Private oracle exceeded hard timeout ${oracleExecution.timeoutMs}ms.`
      : 'Private oracle executed after fake-live steps.',
    timedOut: oracleExecution.timedOut,
    timeoutMs: oracleExecution.timeoutMs,
    wallSeconds: oracleExecution.wallSeconds,
  };
}

function buildClassification(options, stepExecutions, oracleExecution) {
  if (options.mode !== 'fake-live') {
    return {
      routingPolicyFailure: false,
      modelFailure: false,
      harnessFailure: false,
      notes: 'Synthetic dry-run only. oracle.passed=false blocks completion claims.',
    };
  }

  const timedOut = stepExecutions?.some((step) => step.timedOut) || oracleExecution?.timedOut;
  return {
    routingPolicyFailure: false,
    modelFailure: false,
    harnessFailure: Boolean(timedOut),
    notes:
      'Fake-live deterministic local command execution only. No local or frontier LLM was invoked.',
  };
}

function buildStep([stepId, routeDecision, routeTrigger], index, options, workspace, execution) {
  const outputArtifactRefs = execution
    ? [execution.stdoutArtifactRef, execution.stderrArtifactRef, execution.metadataArtifactRef]
    : ['arm-plan.json'];

  return {
    stepId,
    purpose: `Synthetic ${stepId} lane for HA-HR1 ${options.mode}`,
    runner: 'shell',
    model: options.mode === 'fake-live' ? 'fake-live-local-command' : 'dry-run-synthetic',
    providerClass: 'deterministic',
    routeDecision,
    routeTrigger,
    riskLevel: 'low',
    ambiguityLevel: 'low',
    escalationReason: null,
    attemptNumber: index + 1,
    inputArtifactRefs: ['workspace/TASK.md'],
    outputArtifactRefs,
    diffSummary:
      options.mode === 'fake-live'
        ? 'Deterministic local command executed; no LLM edits were attempted.'
        : 'No live edits; workspace skeleton only.',
    reviewDefects: [],
    cwd: workspace,
    startedAt: execution?.startedAt ?? options.startedAt,
    completedAt: execution?.completedAt ?? options.startedAt,
    exitCode: execution ? execution.exitCode : 0,
    stderrArtifactRef: execution?.stderrArtifactRef,
    stdoutArtifactRef: execution?.stdoutArtifactRef,
    timedOut: execution?.timedOut ?? false,
    timeoutMs: execution?.timeoutMs,
    wallSeconds: execution?.wallSeconds ?? 0,
    estimatedUsd: 0,
    gpuActiveSeconds: 0,
    notes: execution
      ? fakeLiveStepNotes(execution)
      : 'Dry-run step emitted by harness-arena runner skeleton.',
  };
}

function fakeLiveStepNotes(execution) {
  if (execution.timedOut) {
    return `Fake-live deterministic command exceeded hard timeout ${execution.timeoutMs}ms; no LLM invoked.`;
  }
  return `Fake-live deterministic command completed within hard timeout ${execution.timeoutMs}ms; no LLM invoked.`;
}

export function validateManifestAgainstSchema(manifest) {
  const errors = [];
  requireKeys(manifest, SCHEMA.required, '$', errors);
  checkEnum(manifest.arm, SCHEMA.properties.arm.enum, '$.arm', errors);
  checkConst(
    manifest.schemaVersion,
    SCHEMA.properties.schemaVersion.const,
    '$.schemaVersion',
    errors,
  );
  checkSteps(manifest.steps, errors);
  requireKeys(manifest.oracle, SCHEMA.properties.oracle.required, '$.oracle', errors);
  if (typeof manifest.oracle?.passed !== 'boolean') errors.push('$.oracle.passed must be boolean');
  return { valid: errors.length === 0, errors };
}

function checkSteps(steps, errors) {
  if (!Array.isArray(steps) || steps.length === 0) {
    errors.push('$.steps must be a nonempty array');
    return;
  }
  steps.forEach((candidate, index) => checkStep(candidate, index, errors));
}

function checkStep(candidate, index, errors) {
  const stepSchema = SCHEMA.properties.steps.items;
  const path = `$.steps[${index}]`;
  requireKeys(candidate, stepSchema.required, path, errors);
  for (const key of ['runner', 'providerClass', 'routeDecision', 'riskLevel', 'ambiguityLevel']) {
    checkEnum(candidate[key], stepSchema.properties[key].enum, `${path}.${key}`, errors);
  }
}

function requireKeys(candidate, keys, path, errors) {
  for (const key of keys) {
    if (!Object.hasOwn(candidate ?? {}, key)) errors.push(`${path}.${key} is required`);
  }
}

function checkEnum(value, allowed, path, errors) {
  if (!allowed.includes(value)) errors.push(`${path} must be one of ${allowed.join(', ')}`);
}

function checkConst(value, expected, path, errors) {
  if (value !== expected) errors.push(`${path} must equal ${expected}`);
}

function assertNoOracleLeak(workspace, oracleCommand) {
  const findings = listWorkspaceFiles(workspace).filter((file) =>
    fileLeaks(workspace, file, oracleCommand),
  );
  if (findings.length > 0) {
    throw new Error(`oracle command leaked into model-visible workspace: ${findings.join(', ')}`);
  }
}

function fileLeaks(workspace, relativeFile, oracleCommand) {
  if (relativeFile.split('/').some(isBlockedSegment)) return true;
  if (!oracleCommand.trim()) return false;
  return readFileSync(join(workspace, ...relativeFile.split('/')), 'utf8').includes(oracleCommand);
}

function listWorkspaceFiles(workspace) {
  const files = [];
  collectFiles(workspace, '', files);
  return files.sort();
}

function stepArtifactDirectory(index, stepId) {
  return `${String(index + 1).padStart(2, '0')}-${stepId}`;
}

function artifactRef(armDir, path) {
  return relative(armDir, path).replaceAll('\\', '/');
}

function ensureFreshDirectory(path) {
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) mkdirSync(path);
  else if (readdirSync(path).length > 0) throw new Error(`run directory already exists: ${path}`);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function timestampId() {
  return new Date()
    .toISOString()
    .replaceAll(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function byName(left, right) {
  return left.name.localeCompare(right.name);
}

export function usage() {
  return `Usage: node experiments/harness-arena/runner.mjs [--dry-run|--fake-live] [--arms all|list] [--output-root dir] [--run-id id]\n`;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(usage());
    return { help: true };
  }
  const result = runHarnessArena(options);
  process.stdout.write(`${JSON.stringify({ runRoot: result.runRoot, arms: options.arms })}\n`);
  return result;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exit(2);
  }
}

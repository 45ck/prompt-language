#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveH14LocalRoute } from './h14-local-routing-policy.mjs';
import { resolveH14QwenCoderRoute } from './h14-qwen3-coder-routing-policy.mjs';
import { resolveH11QwenCoderRoute } from './h11-qwen3-coder-routing-policy.mjs';
import { resolveH15QwenCoderRoute } from './h15-qwen3-coder-routing-policy.mjs';

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
const LIVE_NOTE = `# Harness Arena Live Run

This directory is eligible for operator-supplied live local/frontier model commands.
The private oracle remains outside model-visible workspace input.
`;
const ARG_FIELDS = {
  '--adapter-version': 'adapterVersion',
  '--arms': 'arms',
  '--fake-step-command': 'fakeStepCommand',
  '--fixture': 'fixture',
  '--frontier-call-limit': 'frontierCallLimit',
  '--frontier-endpoint': 'frontierEndpoint',
  '--frontier-model': 'frontierModel',
  '--frontier-provider': 'frontierProvider',
  '--frontier-runner': 'frontierRunner',
  '--h11-qwen-coder-task': 'h11QwenCoderTask',
  '--h14-local-subrole': 'h14LocalSubrole',
  '--h14-qwen-coder-subrole': 'h14QwenCoderSubrole',
  '--h15-qwen-coder-task': 'h15QwenCoderTask',
  '--live-deterministic-command': 'liveDeterministicCommand',
  '--live-frontier-command': 'liveFrontierCommand',
  '--live-frontier-repair-command': 'liveFrontierRepairCommand',
  '--live-local-command': 'liveLocalCommand',
  '--local-endpoint': 'localEndpoint',
  '--local-model': 'localModel',
  '--local-provider': 'localProvider',
  '--local-repair-attempt-limit': 'localRepairAttemptLimit',
  '--local-resource-snapshot-command': 'localResourceSnapshotCommand',
  '--local-resource-snapshot-interval-ms': 'localResourceSnapshotIntervalMs',
  '--local-runner': 'localRunner',
  '--oracle-command': 'oracleCommand',
  '--oracle-timeout-ms': 'oracleTimeoutMs',
  '--output-root': 'outputRoot',
  '--policy-version': 'policyVersion',
  '--retry-policy': 'retryPolicy',
  '--run-group-id': 'runGroupId',
  '--run-id': 'runId',
  '--started-at': 'startedAt',
  '--step-timeout-ms': 'stepTimeoutMs',
  '--task-brief': 'taskBrief',
  '--task-id': 'taskId',
  '--usd-limit': 'usdLimit',
  '--wall-seconds-limit': 'wallSecondsLimit',
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
    adapterVersion: 'harness-arena-live-command-v1',
    arms: 'all',
    fakeStepCommand: null,
    fixture: null,
    frontierCallLimit: null,
    frontierEndpoint: null,
    frontierModel: 'codex-default',
    frontierProvider: 'openai',
    frontierRunner: 'codex',
    h11QwenCoderRoute: null,
    h11QwenCoderTask: null,
    h14LocalRoute: null,
    h14LocalSubrole: null,
    h14QwenCoderRoute: null,
    h14QwenCoderSubrole: null,
    h15QwenCoderRoute: null,
    h15QwenCoderTask: null,
    liveDeterministicCommand: null,
    liveFrontierCommand: null,
    liveFrontierRepairCommand: null,
    liveLocalCommand: null,
    localEndpoint: process.env.PROMPT_LANGUAGE_OLLAMA_BASE_URL ?? null,
    localModel: process.env.EVAL_MODEL?.replace(/^ollama\//, '') ?? 'qwen3:8b',
    localProvider: 'ollama',
    localRepairAttemptLimit: 1,
    localResourceSnapshotCommand: null,
    localResourceSnapshotIntervalMs: null,
    localRunner: 'ollama',
    mode: 'dry-run',
    oracleCommand: DEFAULT_ORACLE_COMMAND,
    oracleTimeoutMs: DEFAULT_ORACLE_TIMEOUT_MS,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    policyVersion: 'hybrid-routing-v0',
    retryPolicy: 'none',
    runGroupId: null,
    runId: null,
    startedAt: null,
    stepTimeoutMs: DEFAULT_STEP_TIMEOUT_MS,
    taskBrief: DEFAULT_TASK_BRIEF,
    taskId: 'HA-HR1-synthetic',
    usdLimit: 0,
    wallSecondsLimit: 1,
  };
  let explicitMode = false;
  let oracleCommandProvided = false;
  const providedFields = new Set();

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
      setMode(options, 'live', explicitMode);
      explicitMode = true;
      continue;
    }
    const field = ARG_FIELDS[arg];
    const value = argv[index + 1];
    if (!field) throw new Error(`Unknown option: ${arg}`);
    if (value == null) throw new Error(`${arg} requires a value`);
    if (field === 'oracleCommand') oracleCommandProvided = true;
    providedFields.add(field);
    options[field] = parseArgValue(field, value, arg);
    index += 1;
  }

  if (options.mode === 'fake-live' && !oracleCommandProvided) {
    options.oracleCommand = defaultFakeOracleCommand();
  }
  const routeProfileCount = [
    options.h11QwenCoderTask,
    options.h14LocalSubrole,
    options.h14QwenCoderSubrole,
    options.h15QwenCoderTask,
  ].filter(Boolean).length;
  if (routeProfileCount > 1) {
    throw new Error(
      'Use only one route profile: --h11-qwen-coder-task, --h14-local-subrole, --h14-qwen-coder-subrole, or --h15-qwen-coder-task',
    );
  }
  applyH11QwenCoderRouteDefaults(options, providedFields);
  applyH14LocalRouteDefaults(options, providedFields);
  applyH14QwenCoderRouteDefaults(options, providedFields);
  applyH15QwenCoderRouteDefaults(options, providedFields);
  if (
    (options.h11QwenCoderRoute ||
      options.h14LocalRoute ||
      options.h14QwenCoderRoute ||
      options.h15QwenCoderRoute) &&
    options.oracleCommand
  ) {
    oracleCommandProvided = true;
  }

  const resolvedArms = resolveArms(options.arms);
  const frontierCallLimit =
    options.frontierCallLimit ?? defaultFrontierCallLimit(resolvedArms, options);
  const budgetedOptions = { ...options, arms: resolvedArms, frontierCallLimit };
  validateH15QwenCoderProfile(budgetedOptions);
  validateBudgetOptions(budgetedOptions);
  validateLiveOptions(budgetedOptions, oracleCommandProvided);

  return {
    ...options,
    arms: resolvedArms,
    frontierCallLimit,
    fixture: options.fixture ? resolve(options.fixture) : null,
    h11QwenCoderRoute: options.h11QwenCoderRoute,
    h14LocalRoute: options.h14LocalRoute,
    h14QwenCoderRoute: options.h14QwenCoderRoute,
    h15QwenCoderRoute: options.h15QwenCoderRoute,
    outputRoot: resolve(options.outputRoot),
    runGroupId: options.runGroupId ?? options.runId ?? 'HA-HR1-structure',
    runId: options.runId ?? timestampId(),
    startedAt: options.startedAt ?? new Date().toISOString(),
  };
}

function parseArgValue(field, value, flag) {
  if (
    field === 'oracleTimeoutMs' ||
    field === 'stepTimeoutMs' ||
    field === 'localResourceSnapshotIntervalMs'
  ) {
    return parsePositiveInteger(value, flag);
  }
  if (field === 'frontierCallLimit' || field === 'localRepairAttemptLimit') {
    return parseNonNegativeInteger(value, flag);
  }
  if (field === 'usdLimit') return parseNonNegativeNumber(value, flag);
  if (field === 'wallSecondsLimit') return parsePositiveInteger(value, flag);
  return value;
}

function applyH11QwenCoderRouteDefaults(options, providedFields) {
  if (!options.h11QwenCoderTask) return;

  const resolved = resolveH11QwenCoderRoute(options.h11QwenCoderTask);
  const route = resolved.route;
  options.h11QwenCoderRoute = resolved;

  if (!providedFields.has('arms')) {
    if (resolved.shouldRunLocal || resolved.shouldRunLocalScreen) options.arms = 'local-only';
    else if (resolved.shouldRunHybrid) options.arms = 'hybrid-router';
    else options.arms = 'frontier-only';
  }
  if (!providedFields.has('fixture')) options.fixture = route.fixture;
  if (!providedFields.has('localModel')) options.localModel = resolved.localDraftModel.name;
  if (!providedFields.has('localProvider')) {
    options.localProvider = resolved.localDraftModel.provider;
  }
  if (!providedFields.has('localRunner')) options.localRunner = resolved.localDraftModel.provider;
  if (!providedFields.has('oracleCommand')) options.oracleCommand = routeOracleCommand(route);
  if (!providedFields.has('policyVersion')) options.policyVersion = resolved.policyVersion;
  if (!providedFields.has('stepTimeoutMs')) {
    options.stepTimeoutMs = resolved.runtimeDefaults?.stepTimeoutMs ?? options.stepTimeoutMs;
  }
  if (!providedFields.has('taskBrief')) options.taskBrief = route.notes;
  if (!providedFields.has('taskId')) options.taskId = route.task;
}

function applyH14LocalRouteDefaults(options, providedFields) {
  if (!options.h14LocalSubrole) return;

  const resolved = resolveH14LocalRoute(options.h14LocalSubrole);
  const route = resolved.route;
  options.h14LocalRoute = resolved;

  if (!providedFields.has('arms')) {
    options.arms = resolved.shouldRunLocal ? 'local-only' : 'frontier-only';
  }
  if (!providedFields.has('fixture')) options.fixture = route.fixture;
  if (resolved.shouldRunLocal) {
    if (!resolved.model) {
      throw new Error(
        `H14 local route ${route.subrole} is local-promoted without a selected model`,
      );
    }
    if (!providedFields.has('localModel')) options.localModel = resolved.model.name;
    if (!providedFields.has('localProvider')) options.localProvider = resolved.model.provider;
    if (!providedFields.has('localRunner')) options.localRunner = resolved.model.provider;
  }
  if (!providedFields.has('oracleCommand')) options.oracleCommand = routeOracleCommand(route);
  if (!providedFields.has('policyVersion')) options.policyVersion = resolved.policyVersion;
  if (!providedFields.has('stepTimeoutMs')) {
    options.stepTimeoutMs = resolved.runtimeDefaults?.stepTimeoutMs ?? options.stepTimeoutMs;
  }
  if (!providedFields.has('taskBrief')) options.taskBrief = route.notes;
  if (!providedFields.has('taskId')) options.taskId = route.subrole;
}

function applyH14QwenCoderRouteDefaults(options, providedFields) {
  if (!options.h14QwenCoderSubrole) return;

  const resolved = resolveH14QwenCoderRoute(options.h14QwenCoderSubrole);
  const route = resolved.route;
  options.h14QwenCoderRoute = resolved;

  if (!providedFields.has('arms')) {
    options.arms = resolved.shouldRunLocal ? 'local-only' : 'frontier-only';
  }
  if (!providedFields.has('fixture')) options.fixture = route.fixture;
  if (!providedFields.has('localModel')) options.localModel = resolved.model.name;
  if (!providedFields.has('localProvider')) options.localProvider = resolved.model.provider;
  if (!providedFields.has('localRunner')) options.localRunner = resolved.model.provider;
  if (!providedFields.has('oracleCommand')) options.oracleCommand = routeOracleCommand(route);
  if (!providedFields.has('policyVersion')) options.policyVersion = resolved.policyVersion;
  if (!providedFields.has('stepTimeoutMs')) {
    options.stepTimeoutMs = resolved.runtimeDefaults?.stepTimeoutMs ?? options.stepTimeoutMs;
  }
  if (!providedFields.has('taskBrief')) options.taskBrief = route.notes;
  if (!providedFields.has('taskId')) options.taskId = route.subrole;
}

function applyH15QwenCoderRouteDefaults(options, providedFields) {
  if (!options.h15QwenCoderTask) return;

  const resolved = resolveH15QwenCoderRoute(options.h15QwenCoderTask);
  const route = resolved.route;
  options.h15QwenCoderRoute = resolved;

  if (!providedFields.has('arms')) {
    if (resolved.shouldRunLocal || resolved.shouldRunLocalScreen) options.arms = 'local-only';
    else if (resolved.shouldRunHybrid) options.arms = 'hybrid-router';
    else options.arms = 'frontier-only';
  }
  if (!providedFields.has('fixture')) options.fixture = route.fixture;
  if (!providedFields.has('localModel')) options.localModel = resolved.localDraftModel.name;
  if (!providedFields.has('localProvider')) {
    options.localProvider = resolved.localDraftModel.provider;
  }
  if (!providedFields.has('localRunner')) options.localRunner = resolved.localDraftModel.provider;
  if (!providedFields.has('oracleCommand')) options.oracleCommand = routeOracleCommand(route);
  if (!providedFields.has('policyVersion')) options.policyVersion = resolved.policyVersion;
  if (!providedFields.has('stepTimeoutMs')) {
    options.stepTimeoutMs = resolved.runtimeDefaults?.stepTimeoutMs ?? options.stepTimeoutMs;
  }
  if (!providedFields.has('taskBrief')) options.taskBrief = route.notes;
  if (!providedFields.has('taskId')) options.taskId = route.task;
}

function validateH15QwenCoderProfile(options) {
  const resolved = options.h15QwenCoderRoute;
  if (!resolved) return;

  const expectedArms = resolved.shouldRunFrontier
    ? ['frontier-only']
    : resolved.shouldRunHybrid
      ? ['hybrid-router']
      : ['local-only'];
  const unexpectedArms = options.arms.filter((arm) => !expectedArms.includes(arm));
  if (unexpectedArms.length > 0 || options.arms.length !== expectedArms.length) {
    throw new Error(
      [
        `H15 route ${resolved.route.task} is ${resolved.route.decision}`,
        `and must run arms ${expectedArms.join(', ')}`,
        `not ${options.arms.join(', ')}`,
      ].join(' '),
    );
  }

  const usesLocalModel = options.arms.some(
    (arm) => arm === 'local-only' || arm === 'hybrid-router',
  );
  if (!usesLocalModel) return;

  const allowedModels = resolved.localCandidateModels.map((model) => model.name);
  if (!allowedModels.includes(options.localModel)) {
    throw new Error(
      [
        `H15 route ${resolved.route.task} permits local models ${allowedModels.join(', ')}`,
        `not ${options.localModel}`,
      ].join(' '),
    );
  }
}

function validateLiveOptions(options, oracleCommandProvided) {
  if (options.mode !== 'live') return;
  if (!oracleCommandProvided) {
    throw new Error('--live requires --oracle-command so model-visible work stays oracle-blind');
  }
  const missingRoutes = requiredLiveRoutes(options.arms).filter(
    (routeDecision) => !liveCommandForRoute(options, routeDecision),
  );
  if (missingRoutes.length > 0) {
    throw new Error(
      `--live requires command templates for selected routes: ${missingRoutes.join(', ')}`,
    );
  }
}

function validateBudgetOptions(options) {
  const plannedFrontierCalls = plannedFrontierStepCount(options.arms);
  if (options.mode !== 'live') return;
  if (options.frontierCallLimit < plannedFrontierCalls) {
    throw new Error(
      `--frontier-call-limit ${options.frontierCallLimit} is below the selected arms' planned frontier step count ${plannedFrontierCalls}`,
    );
  }
}

function defaultFrontierCallLimit(arms, options) {
  return plannedFrontierStepCount(arms) + plannedHybridRepairAllowance(arms, options);
}

function plannedFrontierStepCount(arms) {
  return arms
    .flatMap((arm) => ARM_STEPS[arm])
    .filter(([, routeDecision]) => routeDecision === 'frontier').length;
}

function plannedHybridRepairAllowance(arms, options) {
  if (!arms.includes('hybrid-router')) return 0;
  return options.localRepairAttemptLimit > 0 ? 1 : 0;
}

function requiredLiveRoutes(arms) {
  return [
    ...new Set(arms.flatMap((arm) => ARM_STEPS[arm].map(([, routeDecision]) => routeDecision))),
  ].sort();
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

function parseNonNegativeInteger(value, flag) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || String(parsed) !== value) {
    throw new Error(`${flag} requires a non-negative integer`);
  }
  return parsed;
}

function parseNonNegativeNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${flag} requires a non-negative number`);
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
    claimStatus: claimStatusForMode(options.mode),
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
  const stepExecutions = executeSteps(options, armDir, arm, workspace);
  writeJson(join(armDir, 'arm-plan.json'), {
    mode: options.mode,
    arm,
    taskId: options.taskId,
    workspace,
    plannedSteps: ARM_STEPS[arm].map(([stepId]) => stepId),
    claimStatus: claimStatusForMode(options.mode),
  });
  writeFileSync(join(privateDir, 'oracle-command.txt'), `${options.oracleCommand}\n`, 'utf8');
  assertNoOracleLeak(workspace, options.oracleCommand);
  const oracleExecution = shouldExecutePrivateOracle(options)
    ? executePrivateOracle(options, armDir, workspace)
    : null;
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
  const { note, noteFile } = workspaceRunNote(options.mode);
  writeFileSync(join(workspace, noteFile), note, 'utf8');
}

function syntheticTask(options) {
  return `# HA-HR1 Synthetic Task

Task ID: ${options.taskId}

${options.taskBrief}

This workspace is model-visible input for HA-HR1 ${options.mode} evaluation.
`;
}

function workspaceRunNote(mode) {
  if (mode === 'fake-live') {
    return { note: FAKE_LIVE_NOTE, noteFile: 'HARNESS-ARENA-FAKE-LIVE.md' };
  }
  if (mode === 'live') {
    return { note: LIVE_NOTE, noteFile: 'HARNESS-ARENA-LIVE.md' };
  }
  return { note: DRY_RUN_NOTE, noteFile: 'HARNESS-ARENA-DRY-RUN.md' };
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

function executeSteps(options, armDir, arm, workspace) {
  if (options.mode === 'fake-live') return executeFakeLiveSteps(options, armDir, arm, workspace);
  if (options.mode === 'live') return executeLiveSteps(options, armDir, arm, workspace);
  return null;
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

function executeLiveSteps(options, armDir, arm, workspace) {
  const executions = [];
  const stepDefinitions = [];

  for (const stepDefinition of ARM_STEPS[arm]) {
    const execution = executeLiveStep(
      options,
      armDir,
      arm,
      workspace,
      stepDefinition,
      executions.length,
    );
    executions.push(execution);
    stepDefinitions.push(stepDefinition);

    if (shouldRunHybridRepair(options, arm, stepDefinition, execution, executions.length - 1)) {
      const repairDefinition = ['frontier-repair', 'frontier', 'local public-gate failure repair'];
      const repairExecution = executeLiveStep(
        {
          ...options,
          liveFrontierCommand: options.liveFrontierRepairCommand ?? options.liveFrontierCommand,
        },
        armDir,
        arm,
        workspace,
        repairDefinition,
        executions.length,
      );
      executions.push(repairExecution);
      stepDefinitions.push(repairDefinition);
    }
  }

  executions.stepDefinitions = stepDefinitions;
  return executions;
}

function executeLiveStep(options, armDir, arm, workspace, [stepId, routeDecision], index) {
  const artifactDir = join(armDir, 'artifacts', 'steps', stepArtifactDirectory(index, stepId));
  let command = buildLiveStepCommand(options, arm, stepId, routeDecision, index, workspace);
  const resourceSnapshotArtifactRefs = [];
  const canSnapshot = shouldCaptureLocalResourceSnapshot(options, routeDecision);

  if (canSnapshot) {
    resourceSnapshotArtifactRefs.push(
      ...executeLocalResourceSnapshot(options, armDir, workspace, {
        arm,
        attempt: String(index + 1),
        label: 'before',
        stepId,
      }),
    );
  }

  if (shouldSampleLocalResources(options, routeDecision)) {
    command = sampledLiveStepCommand(options, armDir, workspace, command, {
      arm,
      attempt: String(index + 1),
      artifactDir,
      stepId,
    });
  }

  const execution = executeCommandPhase({
    artifactDir,
    armDir,
    command,
    cwd: workspace,
    phase: 'step',
    timeoutMs: options.stepTimeoutMs,
  });

  resourceSnapshotArtifactRefs.push(...collectResourceSampleArtifactRefs(armDir, artifactDir));

  if (canSnapshot) {
    resourceSnapshotArtifactRefs.push(
      ...executeLocalResourceSnapshot(options, armDir, workspace, {
        arm,
        attempt: String(index + 1),
        label: 'after',
        stepId,
      }),
    );
  }

  return {
    ...execution,
    resourceSnapshotArtifactRefs,
    resourceSnapshotSummary: summarizeResourceSnapshots(armDir, resourceSnapshotArtifactRefs),
  };
}

function shouldCaptureLocalResourceSnapshot(options, routeDecision) {
  return (
    options.mode === 'live' &&
    routeDecision === 'local' &&
    typeof options.localResourceSnapshotCommand === 'string' &&
    options.localResourceSnapshotCommand.trim().length > 0
  );
}

function shouldSampleLocalResources(options, routeDecision) {
  return (
    shouldCaptureLocalResourceSnapshot(options, routeDecision) &&
    Boolean(options.localResourceSnapshotIntervalMs)
  );
}

function sampledLiveStepCommand(options, armDir, workspace, stepCommand, context) {
  const sampleDir = join(context.artifactDir, 'resource-samples');
  mkdirSync(sampleDir, { recursive: true });
  const snapshotCommand = commandFromTemplate(options.localResourceSnapshotCommand, {
    arm: context.arm,
    attempt: context.attempt,
    label: 'sample',
    localEndpoint: options.localEndpoint,
    localModel: options.localModel,
    stepId: context.stepId,
    taskId: options.taskId,
    workspace,
  });
  const wrapperPath = join(context.artifactDir, 'run-with-resource-sampling.sh');
  writeFileSync(
    wrapperPath,
    sampledLiveStepScript({
      intervalSeconds: Number((options.localResourceSnapshotIntervalMs / 1_000).toFixed(3)),
      sampleDir,
      snapshotCommand: [snapshotCommand.command, ...snapshotCommand.args],
      stepCommand: [stepCommand.command, ...stepCommand.args],
    }),
    'utf8',
  );
  return {
    args: [wrapperPath],
    command: 'bash',
    displayCommand: `bash ${quoteCommandArg(artifactRef(armDir, wrapperPath))}`,
  };
}

function sampledLiveStepScript({ intervalSeconds, sampleDir, snapshotCommand, stepCommand }) {
  return `#!/usr/bin/env bash
set +e
sample_dir=${quoteShellArg(sampleDir)}
snapshot_command=(${bashArrayLiteral(snapshotCommand)})
step_command=(${bashArrayLiteral(stepCommand)})
mkdir -p "$sample_dir"
sample_index=1
(
  while true; do
    sample_id=$(printf "%03d" "$sample_index")
    stdout_path="$sample_dir/sample-\${sample_id}-stdout.txt"
    stderr_path="$sample_dir/sample-\${sample_id}-stderr.txt"
    metadata_path="$sample_dir/sample-\${sample_id}-metadata.json"
    metadata_tmp="$metadata_path.tmp"
    "\${snapshot_command[@]}" > "$stdout_path" 2> "$stderr_path"
    sample_exit=$?
    printf '{"phase":"resource-sample","sampleIndex":%s,"exitCode":%s}\\n' "$sample_index" "$sample_exit" > "$metadata_tmp"
    mv "$metadata_tmp" "$metadata_path"
    sample_index=$((sample_index + 1))
    sleep ${quoteShellArg(String(intervalSeconds))}
  done
) &
sampler_pid=$!
"\${step_command[@]}"
step_exit=$?
kill "$sampler_pid" >/dev/null 2>&1
wait "$sampler_pid" >/dev/null 2>&1
exit "$step_exit"
`;
}

function bashArrayLiteral(values) {
  return values.map((value) => quoteShellArg(value)).join(' ');
}

function collectResourceSampleArtifactRefs(armDir, artifactDir) {
  const sampleDir = join(artifactDir, 'resource-samples');
  if (!existsSync(sampleDir)) return [];
  return readdirSync(sampleDir)
    .filter((file) => file.endsWith('.txt') || file.endsWith('.json'))
    .sort()
    .map((file) => artifactRef(armDir, join(sampleDir, file)));
}

function summarizeResourceSnapshots(armDir, artifactRefs) {
  const sampleArtifactRefs = artifactRefs.filter((artifactRef) =>
    artifactRef.includes('/resource-samples/'),
  );
  const sampleMetadataRefs = sampleArtifactRefs.filter((artifactRef) =>
    artifactRef.endsWith('-metadata.json'),
  );
  let sampleNonzeroExitCount = 0;
  let sampleMetadataParseFailureCount = 0;

  for (const artifactRef of sampleMetadataRefs) {
    try {
      const metadata = JSON.parse(readFileSync(join(armDir, artifactRef), 'utf8'));
      if (metadata.exitCode !== 0) sampleNonzeroExitCount += 1;
    } catch {
      sampleMetadataParseFailureCount += 1;
    }
  }

  return {
    totalArtifactRefCount: artifactRefs.length,
    beforeAfterArtifactRefCount: artifactRefs.length - sampleArtifactRefs.length,
    sampleArtifactRefCount: sampleArtifactRefs.length,
    sampleCount: sampleMetadataRefs.length,
    sampleNonzeroExitCount,
    sampleMetadataParseFailureCount,
    sampleStdoutNonEmptyCount: countNonEmptySampleArtifacts(
      armDir,
      sampleArtifactRefs,
      '-stdout.txt',
    ),
    sampleStderrNonEmptyCount: countNonEmptySampleArtifacts(
      armDir,
      sampleArtifactRefs,
      '-stderr.txt',
    ),
  };
}

function countNonEmptySampleArtifacts(armDir, artifactRefs, suffix) {
  return artifactRefs.filter((artifactRef) => {
    if (!artifactRef.endsWith(suffix)) return false;
    try {
      return statSync(join(armDir, artifactRef)).size > 0;
    } catch {
      return false;
    }
  }).length;
}

function executeLocalResourceSnapshot(options, armDir, workspace, { arm, attempt, label, stepId }) {
  const artifactDir = join(armDir, 'artifacts', 'steps', `${attempt}-${stepId}-resources-${label}`);
  const command = commandFromTemplate(options.localResourceSnapshotCommand, {
    arm,
    attempt,
    label,
    localEndpoint: options.localEndpoint,
    localModel: options.localModel,
    stepId,
    taskId: options.taskId,
    workspace,
  });
  const execution = executeCommandPhase({
    artifactDir,
    armDir,
    command,
    cwd: workspace,
    phase: `resource-${label}`,
    timeoutMs: Math.min(options.stepTimeoutMs, 30_000),
  });
  return [execution.stdoutArtifactRef, execution.stderrArtifactRef, execution.metadataArtifactRef];
}

function shouldRunHybridRepair(options, arm, [stepId], execution, stepIndex) {
  return (
    options.localRepairAttemptLimit > 0 &&
    arm === 'hybrid-router' &&
    stepId === 'local-bulk' &&
    (execution.timedOut || execution.exitCode !== 0) &&
    canSpendHybridRepairCall(options, arm, stepIndex)
  );
}

function canSpendHybridRepairCall(options, arm, stepIndex) {
  const completedFrontierCalls = ARM_STEPS[arm]
    .slice(0, stepIndex + 1)
    .filter(([, routeDecision]) => routeDecision === 'frontier').length;
  const remainingPlannedFrontierCalls = ARM_STEPS[arm]
    .slice(stepIndex + 1)
    .filter(([, routeDecision]) => routeDecision === 'frontier').length;
  return completedFrontierCalls + 1 + remainingPlannedFrontierCalls <= options.frontierCallLimit;
}

function shouldExecutePrivateOracle(options) {
  return options.mode === 'fake-live' || options.mode === 'live';
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
      routeDecision: 'deterministic',
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

function buildLiveStepCommand(options, arm, stepId, routeDecision, index, workspace) {
  const template = liveCommandForRoute(options, routeDecision);
  if (!template) throw new Error(`missing live command template for route: ${routeDecision}`);
  validateProfileLiveCommandTemplate(options, template);
  const profileRoute = selectedProfileRoute(options);
  const routeFlow = profileRoute ? join(ROOT, profileRoute.route.flow) : null;
  return commandFromTemplate(template, {
    arm,
    attempt: String(index + 1),
    h11Flow: profileRoute?.profileKind === 'H11' ? routeFlow : null,
    h11FlowRelative: profileRoute?.profileKind === 'H11' ? profileRoute.route.flow : null,
    h14Flow: profileRoute?.profileKind === 'H14' ? routeFlow : null,
    h14FlowRelative: profileRoute?.profileKind === 'H14' ? profileRoute.route.flow : null,
    h15Flow: profileRoute?.profileKind === 'H15' ? routeFlow : null,
    h15FlowRelative: profileRoute?.profileKind === 'H15' ? profileRoute.route.flow : null,
    routeFlow,
    routeFlowRelative: profileRoute?.route.flow ?? null,
    routeDecision,
    stepId,
    taskId: options.taskId,
    workspace,
  });
}

function validateProfileLiveCommandTemplate(options, template) {
  const profileRoute = selectedProfileRoute(options);
  const route = profileRoute?.route;
  if (!profileRoute || !route) return;

  const absoluteFlow = join(ROOT, route.flow);
  if (
    template.includes('<routeFlow>') ||
    template.includes('<routeFlowRelative>') ||
    template.includes('<h11Flow>') ||
    template.includes('<h11FlowRelative>') ||
    template.includes('<h14Flow>') ||
    template.includes('<h14FlowRelative>') ||
    template.includes('<h15Flow>') ||
    template.includes('<h15FlowRelative>') ||
    template.includes(route.flow) ||
    template.includes(absoluteFlow)
  ) {
    return;
  }

  throw new Error(
    `${profileRoute.profileKind} live command must reference the routed flow ${route.flow}; use <routeFlow> for the absolute path.`,
  );
}

function liveCommandForRoute(options, routeDecision) {
  if (routeDecision === 'local') return options.liveLocalCommand;
  if (routeDecision === 'frontier') return options.liveFrontierCommand;
  if (routeDecision === 'deterministic') return options.liveDeterministicCommand;
  return null;
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

function quoteShellArg(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
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

function routeOracleCommand(route) {
  return `${quoteCommandArg(process.execPath)} ${quoteCommandArg(join(ROOT, route.oracle))} --workspace <workspace>`;
}

function buildManifest(options, arm, workspace, stepExecutions = null, oracleExecution = null) {
  return {
    schemaVersion: 2,
    policyVersion: options.policyVersion,
    runId: options.runId,
    taskId: options.taskId,
    arm,
    runGroupId: options.runGroupId,
    claimStatus: claimStatusForMode(options.mode),
    repo: repoMetadata(),
    startedAt: options.startedAt,
    completedAt: options.startedAt,
    budget: {
      frontierCallLimit: options.frontierCallLimit,
      usdLimit: options.usdLimit,
      wallSecondsLimit: options.wallSecondsLimit,
      localRepairAttemptLimit: options.localRepairAttemptLimit,
      retryPolicy: options.retryPolicy,
      enforced: true,
    },
    evidencePolicy: {
      manifestAuthor: 'harness',
      oracleVisibility: 'private-artifacts-only',
      commandEnvironmentPolicy: 'parent-env-inherited',
      providerFallbackPolicy: 'forbid',
      localOnlyAllowsFrontierInput: false,
    },
    steps: manifestStepDefinitions(arm, stepExecutions).map((step, index) =>
      buildStep(step, index, options, workspace, stepExecutions?.[index] ?? null),
    ),
    oracle: buildOracle(options, oracleExecution),
    classification: buildClassification(options, stepExecutions, oracleExecution),
  };
}

function manifestStepDefinitions(arm, stepExecutions) {
  return stepExecutions?.stepDefinitions ?? ARM_STEPS[arm];
}

function claimStatusForMode(mode) {
  if (mode === 'fake-live') return 'fake-live-deterministic-not-model-evidence';
  if (mode === 'live') return 'live-model-evidence';
  return 'structure-only-not-model-evidence';
}

function buildOracle(options, oracleExecution) {
  if (!oracleExecution) {
    return {
      commandArtifactRef: 'private/oracle-command.txt',
      commandSha256: sha256(options.oracleCommand),
      visibility: 'private-artifacts-only',
      exitCode: null,
      passed: false,
      summary: 'Dry-run structure validation only; no task oracle was executed.',
    };
  }

  return {
    commandArtifactRef: 'private/oracle-command.txt',
    commandSha256: sha256(options.oracleCommand),
    visibility: 'private-artifacts-only',
    exitCode: oracleExecution.exitCode,
    passed: oracleExecution.exitCode === 0 && !oracleExecution.timedOut,
    stderrArtifactRef: oracleExecution.stderrArtifactRef,
    stdoutArtifactRef: oracleExecution.stdoutArtifactRef,
    summary: oracleExecution.timedOut
      ? `Private oracle exceeded hard timeout ${oracleExecution.timeoutMs}ms.`
      : `Private oracle executed after ${options.mode} steps.`,
    timedOut: oracleExecution.timedOut,
    timeoutMs: oracleExecution.timeoutMs,
    wallSeconds: oracleExecution.wallSeconds,
  };
}

function buildClassification(options, stepExecutions, oracleExecution) {
  if (options.mode === 'dry-run') {
    return {
      routingPolicyFailure: false,
      modelFailure: false,
      harnessFailure: false,
      resourceFailure: false,
      notes: 'Synthetic dry-run only. oracle.passed=false blocks completion claims.',
    };
  }

  const timedOut = stepExecutions?.some((step) => step.timedOut) || oracleExecution?.timedOut;
  const resourceFailure = stepExecutions?.some(isLocalRuntimeResourceFailure) ?? false;
  return {
    routingPolicyFailure: false,
    modelFailure: Boolean(
      options.mode === 'live' && oracleExecution?.exitCode !== 0 && !resourceFailure,
    ),
    harnessFailure: Boolean(timedOut || resourceFailure),
    resourceFailure,
    notes: classificationNotes(options.mode, { resourceFailure }),
  };
}

function isLocalRuntimeResourceFailure(execution) {
  const combined = [execution?.stdout, execution?.stderr, execution?.error]
    .filter(Boolean)
    .join('\n');
  return /Ollama runner failed: .*?(model requires more system memory|model runner has unexpectedly stopped|resource limit)/is.test(
    combined,
  );
}

function classificationNotes(mode, { resourceFailure = false } = {}) {
  if (resourceFailure) {
    return 'Live lane command could not complete local inference because the local runtime reported a resource limit.';
  }
  if (mode === 'live') {
    return 'Live operator-supplied lane commands executed. Manifest validity depends on private oracle pass/fail artifacts.';
  }
  return 'Fake-live deterministic local command execution only. No local or frontier LLM was invoked.';
}

function buildStep([stepId, routeDecision, routeTrigger], index, options, workspace, execution) {
  const identity = stepIdentityForMode(options, routeDecision);
  const profileRoute = selectedProfileRoute(options);
  const route = profileRoute?.route ?? null;
  const routeId = routeIdentifier(route);
  const promptProgram = route
    ? {
        kind: 'flow',
        path: route.flow,
        sha256: fileSha256FromRoot(route.flow),
      }
    : {
        kind: 'synthetic',
        path: null,
        sha256: sha256(`${options.policyVersion}:${options.mode}:${stepId}`),
      };
  const outputArtifactRefs = execution
    ? [
        execution.stdoutArtifactRef,
        execution.stderrArtifactRef,
        execution.metadataArtifactRef,
        ...(execution.resourceSnapshotArtifactRefs ?? []),
      ]
    : ['arm-plan.json'];

  return {
    stepId,
    purpose: route
      ? `${profileRoute.profileKind} ${routeId} ${stepId} lane for ${options.mode}`
      : `Synthetic ${stepId} lane for HA-HR1 ${options.mode}`,
    runner: identity.runner,
    model: identity.model,
    provider: identity.provider,
    endpoint: identity.endpoint,
    requestedModel: identity.model,
    actualModel: identity.model,
    providerSubstitution: { occurred: false, reason: null },
    adapterVersion: identity.adapterVersion,
    providerClass: identity.providerClass,
    routeDecision,
    routeTrigger: route
      ? `${profileRoute.triggerProfile}:${routeId}:${route.decision}`
      : routeTrigger,
    riskLevel: 'low',
    ambiguityLevel: 'low',
    escalationReason:
      route && !profileRoute.shouldRunLocal && routeDecision === 'frontier'
        ? `${profileRoute.profileKind} ${profileRoute.displayProfile} policy route ${route.decision}`
        : null,
    attemptNumber: index + 1,
    promptProgram,
    cost: {
      basis: 'none',
      estimatedUsd: 0,
      providerReportedUsd: null,
      inputTokens: null,
      outputTokens: null,
      pricingVersion: null,
    },
    dataClassification: 'public',
    frontierCallKind: frontierCallKindForStep(stepId),
    inputArtifactRefs: route ? ['workspace/TASK.md', route.flow] : ['workspace/TASK.md'],
    outputArtifactRefs,
    resourceSnapshotArtifactRefs: execution?.resourceSnapshotArtifactRefs ?? [],
    resourceSnapshotSummary:
      execution?.resourceSnapshotSummary ?? summarizeResourceSnapshots('', []),
    diffSummary:
      options.mode === 'fake-live'
        ? 'Deterministic local command executed; no LLM edits were attempted.'
        : stepDiffSummary(options.mode),
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
    notes: route
      ? `${profileRoute.profileKind} ${profileRoute.displayProfile} policy ${route.decision}. ${stepNotes(options.mode, execution)}`
      : stepNotes(options.mode, execution),
  };
}

function selectedProfileRoute(options) {
  if (options.h11QwenCoderRoute) {
    return {
      ...options.h11QwenCoderRoute,
      displayProfile: 'qwen3-coder',
      profileKind: 'H11',
      triggerProfile: 'h11-qwen3-coder',
    };
  }
  if (options.h14LocalRoute) {
    return {
      ...options.h14LocalRoute,
      displayProfile: 'local-portfolio',
      profileKind: 'H14',
      triggerProfile: 'h14-local-portfolio',
    };
  }
  if (options.h14QwenCoderRoute) {
    return {
      ...options.h14QwenCoderRoute,
      displayProfile: 'qwen3-coder',
      profileKind: 'H14',
      triggerProfile: 'h14-qwen3-coder',
    };
  }
  if (options.h15QwenCoderRoute) {
    return {
      ...options.h15QwenCoderRoute,
      displayProfile: 'qwen3-coder',
      profileKind: 'H15',
      triggerProfile: 'h15-qwen3-coder',
    };
  }
  return null;
}

function routeIdentifier(route) {
  return route?.subrole ?? route?.task ?? null;
}

function stepIdentityForMode(options, routeDecision) {
  if (options.mode === 'live') {
    return liveStepIdentity(options, routeDecision);
  }
  const model = options.mode === 'fake-live' ? 'fake-live-local-command' : 'dry-run-synthetic';
  return {
    adapterVersion: 'harness-arena-runner-v1',
    endpoint: null,
    model,
    provider: 'harness-arena',
    providerClass: 'deterministic',
    runner: 'shell',
  };
}

function liveStepIdentity(options, routeDecision) {
  if (routeDecision === 'frontier') {
    return {
      adapterVersion: options.adapterVersion,
      endpoint: options.frontierEndpoint,
      model: options.frontierModel,
      provider: options.frontierProvider,
      providerClass: 'frontier',
      runner: options.frontierRunner,
    };
  }
  if (routeDecision === 'local') {
    return {
      adapterVersion: options.adapterVersion,
      endpoint: options.localEndpoint,
      model: options.localModel,
      provider: options.localProvider,
      providerClass: 'local',
      runner: options.localRunner,
    };
  }
  return {
    adapterVersion: options.adapterVersion,
    endpoint: null,
    model: 'live-deterministic-command',
    provider: 'harness-arena',
    providerClass: 'deterministic',
    runner: 'shell',
  };
}

function frontierCallKindForStep(stepId) {
  if (stepId.includes('classify')) return 'classifier';
  if (stepId.includes('advice')) return 'advisor';
  if (stepId.includes('repair')) return 'repair';
  if (stepId.includes('review')) return 'review';
  if (stepId.includes('frontier-full')) return 'full-work';
  return 'none';
}

function repoMetadata() {
  return {
    commit: gitOutput(['rev-parse', 'HEAD']) ?? 'unknown',
    dirty: (gitOutput(['status', '--short']) ?? '').trim().length > 0,
  };
}

function gitOutput(args) {
  const result = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 10_000,
    windowsHide: true,
  });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

function fakeLiveStepNotes(execution) {
  if (execution.timedOut) {
    return `Fake-live deterministic command exceeded hard timeout ${execution.timeoutMs}ms; no LLM invoked.`;
  }
  return `Fake-live deterministic command completed within hard timeout ${execution.timeoutMs}ms; no LLM invoked.`;
}

function stepDiffSummary(mode) {
  if (mode === 'live') return 'Operator-supplied live lane command executed.';
  return 'No live edits; workspace skeleton only.';
}

function stepNotes(mode, execution) {
  if (!execution) return 'Dry-run step emitted by harness-arena runner skeleton.';
  if (mode === 'fake-live') return fakeLiveStepNotes(execution);
  if (execution.timedOut) {
    return `Live lane command exceeded hard timeout ${execution.timeoutMs}ms.`;
  }
  return `Live lane command completed within hard timeout ${execution.timeoutMs}ms.`;
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

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fileSha256FromRoot(relativePath) {
  return sha256(readFileSync(join(ROOT, relativePath)));
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
  return `Usage: node experiments/harness-arena/runner.mjs [--dry-run|--fake-live|--live] [--arms all|list] [--h11-qwen-coder-task task] [--h14-local-subrole subrole] [--h14-qwen-coder-subrole subrole] [--h15-qwen-coder-task task] [--frontier-call-limit n] [--usd-limit n] [--wall-seconds-limit n] [--local-repair-attempt-limit n] [--output-root dir] [--run-id id] [--local-resource-snapshot-command command] [--local-resource-snapshot-interval-ms ms]\n`;
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

#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
const LIVE_NOTE = `# Harness Arena Live Run

This directory is eligible for operator-supplied live local/frontier model commands.
The private oracle remains outside model-visible workspace input.
`;
const ARG_FIELDS = {
  '--adapter-version': 'adapterVersion',
  '--arms': 'arms',
  '--fake-step-command': 'fakeStepCommand',
  '--fixture': 'fixture',
  '--frontier-endpoint': 'frontierEndpoint',
  '--frontier-model': 'frontierModel',
  '--frontier-provider': 'frontierProvider',
  '--frontier-runner': 'frontierRunner',
  '--live-deterministic-command': 'liveDeterministicCommand',
  '--live-frontier-command': 'liveFrontierCommand',
  '--live-local-command': 'liveLocalCommand',
  '--local-endpoint': 'localEndpoint',
  '--local-model': 'localModel',
  '--local-provider': 'localProvider',
  '--local-runner': 'localRunner',
  '--oracle-command': 'oracleCommand',
  '--oracle-timeout-ms': 'oracleTimeoutMs',
  '--output-root': 'outputRoot',
  '--policy-version': 'policyVersion',
  '--run-group-id': 'runGroupId',
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
    adapterVersion: 'harness-arena-live-command-v1',
    arms: 'all',
    fakeStepCommand: null,
    fixture: null,
    frontierEndpoint: null,
    frontierModel: 'codex-default',
    frontierProvider: 'openai',
    frontierRunner: 'codex',
    liveDeterministicCommand: null,
    liveFrontierCommand: null,
    liveLocalCommand: null,
    localEndpoint: process.env.PROMPT_LANGUAGE_OLLAMA_BASE_URL ?? null,
    localModel: process.env.EVAL_MODEL?.replace(/^ollama\//, '') ?? 'qwen3:8b',
    localProvider: 'ollama',
    localRunner: 'ollama',
    mode: 'dry-run',
    oracleCommand: DEFAULT_ORACLE_COMMAND,
    oracleTimeoutMs: DEFAULT_ORACLE_TIMEOUT_MS,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    policyVersion: 'hybrid-routing-v0',
    runGroupId: null,
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
      setMode(options, 'live', explicitMode);
      explicitMode = true;
      continue;
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

  const resolvedArms = resolveArms(options.arms);
  validateLiveOptions({ ...options, arms: resolvedArms }, oracleCommandProvided);

  return {
    ...options,
    arms: resolvedArms,
    fixture: options.fixture ? resolve(options.fixture) : null,
    outputRoot: resolve(options.outputRoot),
    runGroupId: options.runGroupId ?? options.runId ?? 'HA-HR1-structure',
    runId: options.runId ?? timestampId(),
    startedAt: options.startedAt ?? new Date().toISOString(),
  };
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
  return ARM_STEPS[arm].map(([stepId, routeDecision], index) => {
    const command = buildLiveStepCommand(options, arm, stepId, routeDecision, index, workspace);
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
  return commandFromTemplate(template, {
    arm,
    attempt: String(index + 1),
    routeDecision,
    stepId,
    taskId: options.taskId,
    workspace,
  });
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
    runGroupId: options.runGroupId,
    claimStatus: claimStatusForMode(options.mode),
    repo: repoMetadata(),
    startedAt: options.startedAt,
    completedAt: options.startedAt,
    budget: {
      frontierCallLimit: 0,
      usdLimit: 0,
      wallSecondsLimit: 1,
      localRepairAttemptLimit: 0,
      retryPolicy: 'none',
      enforced: true,
    },
    evidencePolicy: {
      manifestAuthor: 'harness',
      oracleVisibility: 'private-artifacts-only',
      providerFallbackPolicy: 'forbid',
      localOnlyAllowsFrontierInput: false,
    },
    steps: ARM_STEPS[arm].map((step, index) =>
      buildStep(step, index, options, workspace, stepExecutions?.[index] ?? null),
    ),
    oracle: buildOracle(options, oracleExecution),
    classification: buildClassification(options, stepExecutions, oracleExecution),
  };
}

function claimStatusForMode(mode) {
  if (mode === 'fake-live') return 'fake-live-deterministic-not-model-evidence';
  if (mode === 'live') return 'live-model-evidence';
  return 'structure-only-not-model-evidence';
}

function buildOracle(options, oracleExecution) {
  if (!oracleExecution) {
    return {
      command: options.oracleCommand,
      commandSha256: sha256(options.oracleCommand),
      visibility: 'private-artifacts-only',
      exitCode: null,
      passed: false,
      summary: 'Dry-run structure validation only; no task oracle was executed.',
    };
  }

  return {
    command: options.oracleCommand,
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
      notes: 'Synthetic dry-run only. oracle.passed=false blocks completion claims.',
    };
  }

  const timedOut = stepExecutions?.some((step) => step.timedOut) || oracleExecution?.timedOut;
  return {
    routingPolicyFailure: false,
    modelFailure: Boolean(options.mode === 'live' && oracleExecution?.exitCode !== 0),
    harnessFailure: Boolean(timedOut),
    notes: classificationNotes(options.mode),
  };
}

function classificationNotes(mode) {
  if (mode === 'live') {
    return 'Live operator-supplied lane commands executed. Manifest validity depends on private oracle pass/fail artifacts.';
  }
  return 'Fake-live deterministic local command execution only. No local or frontier LLM was invoked.';
}

function buildStep([stepId, routeDecision, routeTrigger], index, options, workspace, execution) {
  const identity = stepIdentityForMode(options, routeDecision);
  const outputArtifactRefs = execution
    ? [execution.stdoutArtifactRef, execution.stderrArtifactRef, execution.metadataArtifactRef]
    : ['arm-plan.json'];

  return {
    stepId,
    purpose: `Synthetic ${stepId} lane for HA-HR1 ${options.mode}`,
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
    routeTrigger,
    riskLevel: 'low',
    ambiguityLevel: 'low',
    escalationReason: null,
    attemptNumber: index + 1,
    promptProgram: {
      kind: 'synthetic',
      path: null,
      sha256: sha256(`${options.policyVersion}:${options.mode}:${stepId}`),
    },
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
    inputArtifactRefs: ['workspace/TASK.md'],
    outputArtifactRefs,
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
    notes: stepNotes(options.mode, execution),
  };
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
  return `Usage: node experiments/harness-arena/runner.mjs [--dry-run|--fake-live|--live] [--arms all|list] [--output-root dir] [--run-id id]\n`;
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

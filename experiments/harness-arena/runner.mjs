#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const SCHEMA = JSON.parse(readFileSync(join(HERE, 'hybrid-routing-manifest.schema.json'), 'utf8'));
const DEFAULT_OUTPUT_ROOT = join(ROOT, 'experiments', 'results', 'harness-arena');
const ALL_ARMS = ['local-only', 'frontier-only', 'advisor-only', 'hybrid-router'];
const DEFAULT_ORACLE_COMMAND = 'node private/ha-hr1-oracle.mjs --workspace <workspace>';
const DEFAULT_TASK_BRIEF =
  'Synthetic HA-HR1 structure check. Prepare isolated arm workspaces only.';
const DRY_RUN_NOTE = `# Harness Arena Dry Run

This directory exists to validate arm/workspace materialization.
It is not evidence of model quality or task completion.
`;
const ARG_FIELDS = {
  '--arms': 'arms',
  '--fixture': 'fixture',
  '--oracle-command': 'oracleCommand',
  '--output-root': 'outputRoot',
  '--policy-version': 'policyVersion',
  '--run-id': 'runId',
  '--started-at': 'startedAt',
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
    fixture: null,
    oracleCommand: DEFAULT_ORACLE_COMMAND,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    policyVersion: 'hybrid-routing-v0',
    runId: null,
    startedAt: null,
    taskBrief: DEFAULT_TASK_BRIEF,
    taskId: 'HA-HR1-synthetic',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') return { help: true };
    if (arg === '--dry-run') continue;
    if (arg === '--live') throw new Error('live HA-HR1 execution is not implemented yet');
    const field = ARG_FIELDS[arg];
    const value = argv[index + 1];
    if (!field) throw new Error(`Unknown option: ${arg}`);
    if (value == null) throw new Error(`${arg} requires a value`);
    options[field] = value;
    index += 1;
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
    mode: 'dry-run',
    runId: options.runId,
    taskId: options.taskId,
    arms: options.arms,
    manifests: armRuns.map((run) => relative(runRoot, run.manifestPath).replaceAll('\\', '/')),
    claimStatus: 'structure-only-not-model-evidence',
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
  writeJson(join(armDir, 'arm-plan.json'), {
    mode: 'dry-run',
    arm,
    taskId: options.taskId,
    workspace,
    plannedSteps: ARM_STEPS[arm].map(([stepId]) => stepId),
    claimStatus: 'structure-only-not-model-evidence',
  });
  writeFileSync(join(privateDir, 'oracle-command.txt'), `${options.oracleCommand}\n`, 'utf8');
  assertNoOracleLeak(workspace, options.oracleCommand);
  const manifest = buildManifest(options, arm, workspace);
  const validation = validateManifestAgainstSchema(manifest);
  if (!validation.valid) throw new Error(`manifest invalid: ${validation.errors.join('; ')}`);
  const manifestPath = join(armDir, 'hybrid-routing-manifest.json');
  writeJson(manifestPath, manifest);
  return { arm, armDir, manifestPath, workspace };
}

function prepareWorkspace(workspace, options) {
  if (options.fixture) copyModelVisibleFixture(options.fixture, workspace);
  else writeFileSync(join(workspace, 'TASK.md'), syntheticTask(options), 'utf8');
  writeFileSync(join(workspace, 'HARNESS-ARENA-DRY-RUN.md'), DRY_RUN_NOTE, 'utf8');
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

function buildManifest(options, arm, workspace) {
  return {
    schemaVersion: 2,
    policyVersion: options.policyVersion,
    runId: options.runId,
    taskId: options.taskId,
    arm,
    startedAt: options.startedAt,
    completedAt: options.startedAt,
    budget: { frontierCallLimit: 0, usdLimit: 0, wallSecondsLimit: 1 },
    steps: ARM_STEPS[arm].map((step, index) => buildStep(step, index, options, workspace)),
    oracle: {
      command: options.oracleCommand,
      exitCode: null,
      passed: false,
      summary: 'Dry-run structure validation only; no task oracle was executed.',
    },
    classification: {
      routingPolicyFailure: false,
      modelFailure: false,
      harnessFailure: false,
      notes: 'Synthetic dry-run only. oracle.passed=false blocks completion claims.',
    },
  };
}

function buildStep([stepId, routeDecision, routeTrigger], index, options, workspace) {
  return {
    stepId,
    purpose: `Synthetic ${stepId} lane for HA-HR1 dry run`,
    runner: 'shell',
    model: 'dry-run-synthetic',
    providerClass: 'deterministic',
    routeDecision,
    routeTrigger,
    riskLevel: 'low',
    ambiguityLevel: 'low',
    escalationReason: null,
    attemptNumber: index + 1,
    inputArtifactRefs: ['workspace/TASK.md'],
    outputArtifactRefs: ['arm-plan.json'],
    diffSummary: 'No live edits; workspace skeleton only.',
    reviewDefects: [],
    cwd: workspace,
    startedAt: options.startedAt,
    completedAt: options.startedAt,
    exitCode: 0,
    timedOut: false,
    wallSeconds: 0,
    estimatedUsd: 0,
    gpuActiveSeconds: 0,
    notes: 'Dry-run step emitted by harness-arena runner skeleton.',
  };
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
  return `Usage: node experiments/harness-arena/runner.mjs [--dry-run] [--arms all|list] [--output-root dir] [--run-id id]\n`;
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

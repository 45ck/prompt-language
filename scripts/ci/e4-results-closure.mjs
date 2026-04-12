#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const E4_ROOT = join(ROOT, 'experiments', 'results', 'e4-factory');
const RUNS_ROOT = join(E4_ROOT, 'runs');
const COMPARISON_PATH = join(E4_ROOT, 'comparison.md');

const historicalAttempts = [
  {
    name: 'A02-crm-http-headless',
    requiredFiles: ['outcome.md', 'postmortem.md', 'scorecard.json'],
  },
];

const allowedStatuses = new Set(['completed', 'partial', 'failure']);
const allowedVerdicts = new Set(['success', 'partial', 'failure']);
const allowedVerificationStates = new Set(['pass', 'fail', 'not-run']);
const allowedComparativeVerdicts = new Set([
  'prompt-language-better',
  'codex-alone-better',
  'parity',
  'mixed',
  'inconclusive',
]);
const requiredScoreKeys = [
  'scopeCompletion',
  'verification',
  'artifactCompleteness',
  'setupSimplicity',
  'auditability',
  'experimentalControl',
  'automationIntegrity',
  'repeatabilityEvidence',
];

function fail(message) {
  console.error(`[e4-results-closure] FAIL - ${message}`);
  process.exit(1);
}

function readText(path) {
  return readFileSync(path, 'utf8');
}

function assertFile(path, label) {
  if (!existsSync(path)) {
    fail(`missing ${label}: ${path}`);
  }
  if (statSync(path).isDirectory()) {
    fail(`expected file for ${label}, found directory: ${path}`);
  }
}

function assertDirectory(path, label) {
  if (!existsSync(path)) {
    fail(`missing ${label}: ${path}`);
  }
  if (!statSync(path).isDirectory()) {
    fail(`expected directory for ${label}, found file: ${path}`);
  }
}

function readJson(path) {
  try {
    return JSON.parse(readText(path));
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    fail(`invalid JSON at ${path}: ${details}`);
  }
}

function assertString(value, field, manifestPath) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`manifest ${manifestPath} has invalid ${field}`);
  }
}

function assertStringArray(value, field, manifestPath) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`manifest ${manifestPath} has invalid ${field}`);
  }
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      fail(`manifest ${manifestPath} has invalid ${field} entry`);
    }
  }
}

function assertRelativeFile(pathValue, field, manifestPath) {
  assertString(pathValue, field, manifestPath);
  assertFile(join(ROOT, pathValue), `${field} referenced by ${manifestPath}`);
}

function validateScorecard(scorecardPath, expectedRunId) {
  const scorecard = readJson(scorecardPath);

  for (const field of [
    'scoreVersion',
    'runId',
    'scope',
    'question',
    'comparativeVerdict',
    'lanes',
  ]) {
    if (!(field in scorecard)) {
      fail(`scorecard ${scorecardPath} is missing ${field}`);
    }
  }

  assertString(scorecard.scoreVersion, 'scoreVersion', scorecardPath);
  assertString(scorecard.runId, 'runId', scorecardPath);
  if (scorecard.runId !== expectedRunId) {
    fail(
      `scorecard ${scorecardPath} runId mismatch: expected ${expectedRunId}, found ${scorecard.runId}`,
    );
  }
  assertString(scorecard.scope, 'scope', scorecardPath);
  assertString(scorecard.question, 'question', scorecardPath);
  if (!allowedComparativeVerdicts.has(scorecard.comparativeVerdict)) {
    fail(
      `scorecard ${scorecardPath} has unsupported comparativeVerdict ${scorecard.comparativeVerdict}`,
    );
  }
  if (!Array.isArray(scorecard.lanes) || scorecard.lanes.length === 0) {
    fail(`scorecard ${scorecardPath} must contain at least one lane`);
  }
  assertString(scorecard.comparativeSummary, 'comparativeSummary', scorecardPath);
  if (!Array.isArray(scorecard.nextExperimentFocus)) {
    fail(`scorecard ${scorecardPath} has invalid nextExperimentFocus`);
  }

  for (const lane of scorecard.lanes) {
    for (const field of ['lane', 'candidate', 'scores', 'totals', 'notes']) {
      if (!(field in lane)) {
        fail(`scorecard ${scorecardPath} has lane missing ${field}`);
      }
    }
    assertString(lane.lane, 'lane', scorecardPath);
    assertString(lane.candidate, 'candidate', scorecardPath);
    assertString(lane.notes, 'notes', scorecardPath);
    if (typeof lane.scores !== 'object' || lane.scores === null) {
      fail(`scorecard ${scorecardPath} has invalid scores object`);
    }
    if (typeof lane.totals !== 'object' || lane.totals === null) {
      fail(`scorecard ${scorecardPath} has invalid totals object`);
    }

    for (const key of requiredScoreKeys) {
      const value = lane.scores[key];
      if (!Number.isInteger(value) || value < 0 || value > 2) {
        fail(`scorecard ${scorecardPath} has invalid scores.${key}`);
      }
    }

    const productOutcome =
      lane.scores.scopeCompletion + lane.scores.verification + lane.scores.artifactCompleteness;
    const operationalQuality = lane.scores.setupSimplicity + lane.scores.auditability;
    const researchStrength =
      lane.scores.experimentalControl +
      lane.scores.automationIntegrity +
      lane.scores.repeatabilityEvidence;
    const overall = productOutcome + operationalQuality + researchStrength;

    if (lane.totals.productOutcome !== productOutcome) {
      fail(`scorecard ${scorecardPath} has inconsistent totals.productOutcome`);
    }
    if (lane.totals.operationalQuality !== operationalQuality) {
      fail(`scorecard ${scorecardPath} has inconsistent totals.operationalQuality`);
    }
    if (lane.totals.researchStrength !== researchStrength) {
      fail(`scorecard ${scorecardPath} has inconsistent totals.researchStrength`);
    }
    if (lane.totals.overall !== overall) {
      fail(`scorecard ${scorecardPath} has inconsistent totals.overall`);
    }
  }
}

function validateManifest(runId, manifestPath) {
  const manifest = readJson(manifestPath);

  for (const field of [
    'runId',
    'lane',
    'candidate',
    'model',
    'workspaceRoot',
    'resultsRoot',
    'verificationCommands',
    'status',
    'verdict',
    'outcomePath',
    'postmortemPath',
    'interventionsPath',
    'scorecardPath',
    'comparisonPath',
  ]) {
    if (!(field in manifest)) {
      fail(`manifest ${manifestPath} is missing ${field}`);
    }
  }

  assertString(manifest.runId, 'runId', manifestPath);
  if (manifest.runId !== runId) {
    fail(`manifest ${manifestPath} runId mismatch: expected ${runId}, found ${manifest.runId}`);
  }
  assertString(manifest.lane, 'lane', manifestPath);
  assertString(manifest.candidate, 'candidate', manifestPath);
  assertString(manifest.model, 'model', manifestPath);
  assertString(manifest.workspaceRoot, 'workspaceRoot', manifestPath);
  assertString(manifest.resultsRoot, 'resultsRoot', manifestPath);
  assertStringArray(manifest.verificationCommands, 'verificationCommands', manifestPath);

  if (!allowedStatuses.has(manifest.status)) {
    fail(`manifest ${manifestPath} has unsupported status ${manifest.status}`);
  }
  if (!allowedVerdicts.has(manifest.verdict)) {
    fail(`manifest ${manifestPath} has unsupported verdict ${manifest.verdict}`);
  }

  if (typeof manifest.artifactsComplete !== 'boolean') {
    fail(`manifest ${manifestPath} has invalid artifactsComplete`);
  }
  if (!Array.isArray(manifest.missingArtifacts)) {
    fail(`manifest ${manifestPath} has invalid missingArtifacts`);
  }
  if (manifest.artifactsComplete && manifest.missingArtifacts.length > 0) {
    fail(`manifest ${manifestPath} marks artifactsComplete but still lists missing artifacts`);
  }

  if (typeof manifest.comparisonUpdated !== 'boolean' || manifest.comparisonUpdated !== true) {
    fail(`manifest ${manifestPath} must record comparisonUpdated: true`);
  }
  if (!Array.isArray(manifest.followups)) {
    fail(`manifest ${manifestPath} has invalid followups`);
  }

  if (typeof manifest.verification !== 'object' || manifest.verification === null) {
    fail(`manifest ${manifestPath} has invalid verification object`);
  }
  for (const key of ['lint', 'typecheck', 'test']) {
    const state = manifest.verification[key];
    if (typeof state !== 'string' || !allowedVerificationStates.has(state)) {
      fail(`manifest ${manifestPath} has invalid verification.${key}`);
    }
  }

  assertRelativeFile(manifest.outcomePath, 'outcomePath', manifestPath);
  assertRelativeFile(manifest.postmortemPath, 'postmortemPath', manifestPath);
  assertRelativeFile(manifest.interventionsPath, 'interventionsPath', manifestPath);
  assertRelativeFile(manifest.scorecardPath, 'scorecardPath', manifestPath);
  assertRelativeFile(manifest.comparisonPath, 'comparisonPath', manifestPath);
}

assertDirectory(E4_ROOT, 'E4 results root');
assertDirectory(RUNS_ROOT, 'E4 runs root');
assertFile(COMPARISON_PATH, 'canonical comparison');

const comparisonText = readText(COMPARISON_PATH);

for (const attempt of historicalAttempts) {
  const attemptRoot = join(E4_ROOT, attempt.name);
  assertDirectory(attemptRoot, `historical attempt ${attempt.name}`);
  for (const relativePath of attempt.requiredFiles) {
    assertFile(join(attemptRoot, relativePath), `${attempt.name}/${relativePath}`);
  }
  validateScorecard(join(attemptRoot, 'scorecard.json'), attempt.name);
  if (!comparisonText.includes(attempt.name)) {
    fail(`comparison.md does not mention historical attempt ${attempt.name}`);
  }
}

const runIds = readdirSync(RUNS_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (runIds.length === 0) {
  fail('no run directories found under experiments/results/e4-factory/runs');
}

for (const runId of runIds) {
  const runRoot = join(RUNS_ROOT, runId);
  assertFile(join(runRoot, 'outcome.md'), `${runId}/outcome.md`);
  assertFile(join(runRoot, 'postmortem.md'), `${runId}/postmortem.md`);
  assertFile(join(runRoot, 'interventions.md'), `${runId}/interventions.md`);
  assertFile(join(runRoot, 'scorecard.json'), `${runId}/scorecard.json`);
  validateScorecard(join(runRoot, 'scorecard.json'), runId);

  if (!comparisonText.includes(runId)) {
    fail(`comparison.md does not mention run ${runId}`);
  }

  const manifestPaths = readdirSync(runRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(runRoot, entry.name, 'manifest.json'))
    .filter((manifestPath) => existsSync(manifestPath));

  if (manifestPaths.length === 0) {
    fail(`run ${runId} does not contain any lane manifest.json files`);
  }

  for (const manifestPath of manifestPaths) {
    validateManifest(runId, manifestPath);
  }
}

console.log(
  `[e4-results-closure] PASS - validated ${historicalAttempts.length} historical attempts and ${runIds.length} repeatable runs.`,
);

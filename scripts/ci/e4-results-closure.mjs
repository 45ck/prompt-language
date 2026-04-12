#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const E4_ROOT = join(ROOT, 'experiments', 'results', 'e4-factory');
const RUNS_ROOT = join(E4_ROOT, 'runs');
const BATCHES_ROOT = join(E4_ROOT, 'batches');
const COMPARISON_PATH = join(E4_ROOT, 'comparison.md');

const historicalAttempts = [
  {
    name: 'A02-crm-http-headless',
    requiredFiles: ['outcome.md', 'postmortem.md', 'scorecard.json', 'trace-summary.md'],
  },
];

const allowedStatuses = new Set(['completed', 'partial', 'failure']);
const allowedVerdicts = new Set(['success', 'partial', 'failure']);
const allowedVerificationStates = new Set(['pass', 'fail', 'not-run']);
const allowedAdmissibilityClasses = new Set([
  'primary-comparison',
  'supporting-context',
  'historical-failure',
]);
const allowedComparativeVerdicts = new Set([
  'prompt-language-better',
  'codex-alone-better',
  'parity',
  'mixed',
  'inconclusive',
]);
const allowedFailureClasses = new Set(['none', 'runtime', 'config', 'product', 'evidence']);
const allowedTraceCompleteness = new Set(['strong', 'mixed', 'weak']);
const allowedOrdinalQuality = new Set(['strong', 'mixed', 'weak']);
const allowedRecoveryQuality = new Set(['strong', 'mixed', 'weak', 'n/a']);
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
const requiredScoreKeysV2 = [...requiredScoreKeys, 'closureQuality', 'processConformance'];

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

function assertRelativeFileArray(value, field, manifestPath) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`manifest ${manifestPath} has invalid ${field}`);
  }
  for (const entry of value) {
    assertString(entry, `${field} entry`, manifestPath);
    const resolvedPath = join(ROOT, entry);
    assertFile(resolvedPath, `${field} referenced by ${manifestPath}`);
    if (statSync(resolvedPath).size <= 0) {
      fail(`manifest ${manifestPath} references empty ${field} artifact ${entry}`);
    }
  }
}

function assertTraceArtifactMatch(traceArtifacts, manifestPath, requiredFragment) {
  if (!traceArtifacts.some((artifactPath) => artifactPath.includes(requiredFragment))) {
    fail(`manifest ${manifestPath} must reference trace artifact containing "${requiredFragment}"`);
  }
}

function validateRunMetadata(runJsonPath, expectedRunId) {
  const runMetadata = readJson(runJsonPath);
  for (const field of ['runId', 'attemptLabel', 'scenario', 'order', 'model', 'startedAt']) {
    if (!(field in runMetadata)) {
      fail(`run metadata ${runJsonPath} is missing ${field}`);
    }
  }
  assertString(runMetadata.runId, 'runId', runJsonPath);
  if (runMetadata.runId !== expectedRunId) {
    fail(
      `run metadata ${runJsonPath} runId mismatch: expected ${expectedRunId}, found ${runMetadata.runId}`,
    );
  }
  assertString(runMetadata.attemptLabel, 'attemptLabel', runJsonPath);
  assertString(runMetadata.scenario, 'scenario', runJsonPath);
  assertString(runMetadata.order, 'order', runJsonPath);
  assertString(runMetadata.model, 'model', runJsonPath);
  assertString(runMetadata.startedAt, 'startedAt', runJsonPath);
  if (runMetadata.protocolVersion === 'e4-v2') {
    for (const field of [
      'endedAt',
      'gitCommit',
      'nodeVersion',
      'npmVersion',
      'codexVersion',
      'controlFile',
      'controlHash',
      'promptFile',
      'promptHash',
    ]) {
      if (!(field in runMetadata)) {
        fail(`run metadata ${runJsonPath} is missing ${field}`);
      }
      assertString(runMetadata[field], field, runJsonPath);
    }
    if (typeof runMetadata.bootstrapSeed !== 'object' || runMetadata.bootstrapSeed === null) {
      fail(`run metadata ${runJsonPath} has invalid bootstrapSeed`);
    }
    for (const field of ['seedHash', 'overlayHash']) {
      assertString(runMetadata.bootstrapSeed[field], `bootstrapSeed.${field}`, runJsonPath);
    }
    if (typeof runMetadata.evaluationModel !== 'object' || runMetadata.evaluationModel === null) {
      fail(`run metadata ${runJsonPath} has invalid evaluationModel`);
    }
    for (const field of ['claimType', 'primaryEndpoint', 'secondaryEndpoints']) {
      if (!(field in runMetadata.evaluationModel)) {
        fail(`run metadata ${runJsonPath} is missing evaluationModel.${field}`);
      }
    }
  }
  if ('batch' in runMetadata && runMetadata.batch !== null) {
    if (typeof runMetadata.batch !== 'object') {
      fail(`run metadata ${runJsonPath} has invalid batch`);
    }
    assertString(runMetadata.batch.batchId, 'batch.batchId', runJsonPath);
    if ('pairId' in runMetadata.batch && runMetadata.batch.pairId !== null) {
      assertString(runMetadata.batch.pairId, 'batch.pairId', runJsonPath);
    }
  }
}

function validateScorecard(scorecardPath, expectedRunId) {
  const scorecard = readJson(scorecardPath);
  const isV2 = scorecard.scoreVersion === 'e4-v2';

  for (const field of [
    'scoreVersion',
    'runId',
    'scope',
    'question',
    'admissibility',
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
  if (isV2) {
    if (typeof scorecard.evaluationModel !== 'object' || scorecard.evaluationModel === null) {
      fail(`scorecard ${scorecardPath} has invalid evaluationModel`);
    }
    assertString(scorecard.evaluationModel.claimType, 'evaluationModel.claimType', scorecardPath);
    assertString(
      scorecard.evaluationModel.primaryEndpoint,
      'evaluationModel.primaryEndpoint',
      scorecardPath,
    );
    if (!Array.isArray(scorecard.evaluationModel.secondaryEndpoints)) {
      fail(`scorecard ${scorecardPath} has invalid evaluationModel.secondaryEndpoints`);
    }
  }
  if (typeof scorecard.admissibility !== 'object' || scorecard.admissibility === null) {
    fail(`scorecard ${scorecardPath} has invalid admissibility object`);
  }
  if (!allowedAdmissibilityClasses.has(scorecard.admissibility.class)) {
    fail(
      `scorecard ${scorecardPath} has unsupported admissibility class ${scorecard.admissibility.class}`,
    );
  }
  if (typeof scorecard.admissibility.throughputClaimEligible !== 'boolean') {
    fail(`scorecard ${scorecardPath} has invalid admissibility.throughputClaimEligible`);
  }
  if (isV2) {
    if (
      typeof scorecard.admissibility.claimEligibility !== 'object' ||
      scorecard.admissibility.claimEligibility === null
    ) {
      fail(`scorecard ${scorecardPath} has invalid admissibility.claimEligibility`);
    }
    for (const field of ['throughput', 'factoryQuality', 'recovery']) {
      if (typeof scorecard.admissibility.claimEligibility[field] !== 'boolean') {
        fail(`scorecard ${scorecardPath} has invalid admissibility.claimEligibility.${field}`);
      }
    }
  }
  assertString(scorecard.admissibility.reason, 'admissibility.reason', scorecardPath);
  if ('batch' in scorecard && scorecard.batch !== null) {
    if (typeof scorecard.batch !== 'object') {
      fail(`scorecard ${scorecardPath} has invalid batch`);
    }
    assertString(scorecard.batch.batchId, 'batch.batchId', scorecardPath);
    if ('pairId' in scorecard.batch && scorecard.batch.pairId !== null) {
      assertString(scorecard.batch.pairId, 'batch.pairId', scorecardPath);
    }
  }
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
    for (const field of [
      'lane',
      'candidate',
      'metrics',
      'scores',
      'totals',
      'scoreEvidence',
      'notes',
    ]) {
      if (!(field in lane)) {
        fail(`scorecard ${scorecardPath} has lane missing ${field}`);
      }
    }
    assertString(lane.lane, 'lane', scorecardPath);
    assertString(lane.candidate, 'candidate', scorecardPath);
    assertString(lane.notes, 'notes', scorecardPath);
    if (typeof lane.metrics !== 'object' || lane.metrics === null) {
      fail(`scorecard ${scorecardPath} has invalid metrics object`);
    }
    if (typeof lane.scores !== 'object' || lane.scores === null) {
      fail(`scorecard ${scorecardPath} has invalid scores object`);
    }
    if (typeof lane.totals !== 'object' || lane.totals === null) {
      fail(`scorecard ${scorecardPath} has invalid totals object`);
    }
    if (typeof lane.scoreEvidence !== 'object' || lane.scoreEvidence === null) {
      fail(`scorecard ${scorecardPath} has invalid scoreEvidence object`);
    }

    for (const key of [
      'timeToGreenSec',
      'timeToFirstCodeSec',
      'timeToFirstRelevantWriteSec',
      'interventionCount',
      'restartCount',
      'runtimeFailureCount',
    ]) {
      const value = key in lane.metrics ? lane.metrics[key] : null;
      if (value !== null && (!Number.isFinite(value) || value < 0)) {
        fail(`scorecard ${scorecardPath} has invalid metrics.${key}`);
      }
    }
    if (!allowedFailureClasses.has(lane.metrics.failureClass)) {
      fail(`scorecard ${scorecardPath} has invalid metrics.failureClass`);
    }
    if (typeof lane.metrics.throughputMetricsComplete !== 'boolean') {
      fail(`scorecard ${scorecardPath} has invalid metrics.throughputMetricsComplete`);
    }
    if (!allowedTraceCompleteness.has(lane.metrics.traceCompleteness)) {
      fail(`scorecard ${scorecardPath} has invalid metrics.traceCompleteness`);
    }
    if (isV2) {
      for (const key of [
        'closureCompleteness',
        'traceAuthority',
        'processConformance',
        'reuseReadiness',
      ]) {
        if (!allowedOrdinalQuality.has(lane.metrics[key])) {
          fail(`scorecard ${scorecardPath} has invalid metrics.${key}`);
        }
      }
      if (typeof lane.metrics.artifactContractPass !== 'boolean') {
        fail(`scorecard ${scorecardPath} has invalid metrics.artifactContractPass`);
      }
      if (!allowedRecoveryQuality.has(lane.metrics.recoveryQuality)) {
        fail(`scorecard ${scorecardPath} has invalid metrics.recoveryQuality`);
      }
      if (
        !Number.isFinite(lane.metrics.verificationPassRate) ||
        lane.metrics.verificationPassRate < 0 ||
        lane.metrics.verificationPassRate > 1
      ) {
        fail(`scorecard ${scorecardPath} has invalid metrics.verificationPassRate`);
      }
      for (const key of ['resumeToGreenSec', 'interruptToGreenSec']) {
        const value = lane.metrics[key];
        if (value !== null && (!Number.isFinite(value) || value < 0)) {
          fail(`scorecard ${scorecardPath} has invalid metrics.${key}`);
        }
      }
    }

    const scoreKeys = isV2 ? requiredScoreKeysV2 : requiredScoreKeys;
    for (const key of scoreKeys) {
      const value = lane.scores[key];
      if (!Number.isInteger(value) || value < 0 || value > 2) {
        fail(`scorecard ${scorecardPath} has invalid scores.${key}`);
      }
      const evidenceRefs = lane.scoreEvidence[key];
      if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0) {
        fail(`scorecard ${scorecardPath} is missing scoreEvidence.${key}`);
      }
      for (const refPath of evidenceRefs) {
        assertString(refPath, `scoreEvidence.${key} entry`, scorecardPath);
        assertFile(join(ROOT, refPath), `scoreEvidence.${key} referenced by ${scorecardPath}`);
      }
    }

    const productOutcome =
      lane.scores.scopeCompletion + lane.scores.verification + lane.scores.artifactCompleteness;
    const operationalQuality = lane.scores.setupSimplicity + lane.scores.auditability;
    const researchStrength =
      lane.scores.experimentalControl +
      lane.scores.automationIntegrity +
      lane.scores.repeatabilityEvidence;
    const factoryQuality = isV2
      ? Object.values(lane.factoryQuality ?? {}).reduce((sum, value) => sum + value, 0)
      : 0;
    const overall = productOutcome + operationalQuality + researchStrength + factoryQuality;

    if (lane.totals.productOutcome !== productOutcome) {
      fail(`scorecard ${scorecardPath} has inconsistent totals.productOutcome`);
    }
    if (lane.totals.operationalQuality !== operationalQuality) {
      fail(`scorecard ${scorecardPath} has inconsistent totals.operationalQuality`);
    }
    if (lane.totals.researchStrength !== researchStrength) {
      fail(`scorecard ${scorecardPath} has inconsistent totals.researchStrength`);
    }
    if (isV2) {
      if (typeof lane.factoryQuality !== 'object' || lane.factoryQuality === null) {
        fail(`scorecard ${scorecardPath} has invalid factoryQuality object`);
      }
      for (const field of [
        'closureQuality',
        'processConformance',
        'traceAuthority',
        'reuseReadiness',
        'claimStrength',
      ]) {
        const value = lane.factoryQuality[field];
        if (!Number.isInteger(value) || value < 0 || value > 2) {
          fail(`scorecard ${scorecardPath} has invalid factoryQuality.${field}`);
        }
      }
      if (lane.totals.factoryQuality !== factoryQuality) {
        fail(`scorecard ${scorecardPath} has inconsistent totals.factoryQuality`);
      }
    }
    if (lane.totals.overall !== overall) {
      fail(`scorecard ${scorecardPath} has inconsistent totals.overall`);
    }

    if (
      scorecard.admissibility.throughputClaimEligible &&
      !lane.metrics.throughputMetricsComplete
    ) {
      fail(
        `scorecard ${scorecardPath} marks throughputClaimEligible but lane ${lane.lane} lacks complete throughput metrics`,
      );
    }
  }
}

function validateManifest(runId, manifestPath) {
  const manifest = readJson(manifestPath);
  const requiresV2Fields =
    typeof manifest.laneSummaryPath === 'string' || manifest.scenario === 'factory-quality';

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
    'traceSummaryPath',
    'traceArtifacts',
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
  assertRelativeFile(manifest.traceSummaryPath, 'traceSummaryPath', manifestPath);
  if (requiresV2Fields) {
    assertRelativeFile(manifest.laneSummaryPath, 'laneSummaryPath', manifestPath);
  }
  assertRelativeFileArray(manifest.traceArtifacts, 'traceArtifacts', manifestPath);
  assertRelativeFile(manifest.comparisonPath, 'comparisonPath', manifestPath);

  if (manifest.candidate === 'codex-alone') {
    for (const requiredFragment of [
      'events.jsonl',
      'stderr.log',
      'last-message.txt',
      'lint.log',
      'typecheck.log',
      'test.log',
    ]) {
      assertTraceArtifactMatch(manifest.traceArtifacts, manifestPath, requiredFragment);
    }
  }

  if (manifest.candidate === 'prompt-language') {
    for (const requiredFragment of ['session-state.json', 'audit.jsonl']) {
      assertTraceArtifactMatch(manifest.traceArtifacts, manifestPath, requiredFragment);
    }
  }

  if (requiresV2Fields) {
    for (const requiredFragment of [
      'lane-summary.json',
      'artifact-inventory.json',
      'system-before.json',
      'system-after.json',
    ]) {
      assertTraceArtifactMatch(manifest.traceArtifacts, manifestPath, requiredFragment);
    }
  }
}

assertDirectory(E4_ROOT, 'E4 results root');
assertDirectory(RUNS_ROOT, 'E4 runs root');
assertFile(COMPARISON_PATH, 'canonical comparison');

const comparisonText = readText(COMPARISON_PATH);
let batchCount = 0;

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
  assertFile(join(runRoot, 'run.json'), `${runId}/run.json`);
  assertFile(join(runRoot, 'outcome.md'), `${runId}/outcome.md`);
  assertFile(join(runRoot, 'postmortem.md'), `${runId}/postmortem.md`);
  assertFile(join(runRoot, 'interventions.md'), `${runId}/interventions.md`);
  assertFile(join(runRoot, 'scorecard.json'), `${runId}/scorecard.json`);
  assertFile(join(runRoot, 'trace-summary.md'), `${runId}/trace-summary.md`);
  validateRunMetadata(join(runRoot, 'run.json'), runId);
  const scorecardPath = join(runRoot, 'scorecard.json');
  validateScorecard(scorecardPath, runId);
  const scorecard = readJson(scorecardPath);
  if (scorecard.scoreVersion === 'e4-v2') {
    assertFile(join(runRoot, 'postmortem.json'), `${runId}/postmortem.json`);
    assertFile(join(runRoot, 'interventions.json'), `${runId}/interventions.json`);
  }

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

  if (scorecard.admissibility.class === 'primary-comparison') {
    if (manifestPaths.length !== 2) {
      fail(`primary comparison run ${runId} must contain exactly two lane manifests`);
    }
    const manifestCandidates = manifestPaths
      .map((manifestPath) => readJson(manifestPath).candidate)
      .sort();
    if (manifestCandidates.join(',') !== 'codex-alone,prompt-language') {
      fail(
        `primary comparison run ${runId} must contain one codex-alone candidate and one prompt-language candidate`,
      );
    }
    if (!Array.isArray(scorecard.lanes) || scorecard.lanes.length !== 2) {
      fail(`primary comparison run ${runId} must contain exactly two scorecard lanes`);
    }
  }

  for (const manifestPath of manifestPaths) {
    validateManifest(runId, manifestPath);
  }
}

if (existsSync(BATCHES_ROOT)) {
  const batchIds = readdirSync(BATCHES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const batchId of batchIds) {
    const batchRoot = join(BATCHES_ROOT, batchId);
    assertFile(join(batchRoot, 'plan.json'), `${batchId}/plan.json`);
    assertFile(join(batchRoot, 'pairs.json'), `${batchId}/pairs.json`);
    assertFile(join(batchRoot, 'summary.json'), `${batchId}/summary.json`);
    assertFile(join(batchRoot, 'summary.md'), `${batchId}/summary.md`);
    batchCount += 1;
  }
}

console.log(
  `[e4-results-closure] PASS - validated ${historicalAttempts.length} historical attempts, ${runIds.length} repeatable runs, and ${batchCount} batches.`,
);

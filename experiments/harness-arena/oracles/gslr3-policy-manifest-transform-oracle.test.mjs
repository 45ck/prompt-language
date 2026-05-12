import assert from 'node:assert/strict';

/* cspell:ignore rawpayload sourcepayload studentpayload */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ORACLE = new URL('./gslr3-policy-manifest-transform-oracle.mjs', import.meta.url).pathname;

function tempWorkspace() {
  const workspace = join(tmpdir(), `gslr3-oracle-${process.pid}-${Date.now()}-${Math.random()}`);
  mkdirSync(join(workspace, 'src'), { recursive: true });
  return workspace;
}

function runOracle(workspace) {
  return spawnSync(process.execPath, [ORACLE, '--workspace', workspace], {
    encoding: 'utf8',
  });
}

function writeImplementation(workspace, source) {
  writeFileSync(join(workspace, 'src', 'evidence-card-transform.mjs'), source, 'utf8');
}

const validImplementation = String.raw`
const FORBIDDEN_KEYS = new Set([
  'rawpayload',
  'sourcepayload',
  'studentpayload',
  'credential',
  'secret',
  'token',
  'password',
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function addError(errors, message) {
  errors.push(message);
}

function scanForbiddenKeys(value, path, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbiddenKeys(item, path + '[' + index + ']', errors));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) addError(errors, 'forbidden raw or secret key at ' + path + '.' + key);
    scanForbiddenKeys(child, path + '.' + key, errors);
  }
}

function numberOrZero(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function firstStepValue(steps, field) {
  for (const step of steps) {
    if (typeof step?.[field] === 'string' && step[field].trim()) return step[field];
  }
  return null;
}

function reviewDefects(steps) {
  return steps.flatMap((step) => Array.isArray(step?.reviewDefects) ? step.reviewDefects : []).filter((defect) => typeof defect === 'string' && defect.trim());
}

function frontierTokens(steps) {
  return steps.reduce((total, step) => total + (step?.frontierCallKind && step.frontierCallKind !== 'none' ? numberOrZero(step?.cost?.totalTokens) : 0), 0);
}

function cachedTokens(steps) {
  return steps.reduce((total, step) => total + numberOrZero(step?.cost?.cachedInputTokens), 0);
}

function providerUsd(steps) {
  return Number(steps.reduce((total, step) => total + numberOrZero(step?.cost?.providerReportedUsd), 0).toFixed(6));
}

function localWallSeconds(steps) {
  return Number(steps.reduce((total, step) => total + (step?.routeDecision === 'local' ? numberOrZero(step?.wallSeconds) : 0), 0).toFixed(3));
}

export function buildEvidenceCardInput(manifest) {
  const errors = [];
  if (!isRecord(manifest)) {
    return { ok: false, errors: ['manifest must be an object'], card: null };
  }

  scanForbiddenKeys(manifest, 'manifest', errors);

  const steps = Array.isArray(manifest.steps) ? manifest.steps : [];
  if (!Array.isArray(manifest.steps) || steps.length === 0) addError(errors, 'steps must be a non-empty array');
  if (typeof manifest.runId !== 'string' || !manifest.runId.trim()) addError(errors, 'runId is required');
  if (typeof manifest.taskId !== 'string' || !manifest.taskId.trim()) addError(errors, 'taskId is required');
  if (typeof manifest.arm !== 'string' || !manifest.arm.trim()) addError(errors, 'arm is required');
  const finalStatus = manifest.finalVerdict?.status;
  if (!['pass', 'fail'].includes(finalStatus)) addError(errors, 'finalVerdict.status must be pass or fail');
  const oraclePassed = manifest.oracle?.passed;
  if (typeof oraclePassed !== 'boolean') addError(errors, 'oracle.passed must be boolean');
  const defects = reviewDefects(steps);

  if (errors.length > 0) return { ok: false, errors, card: null };
  const clearForResearch = finalStatus === 'pass' && oraclePassed === true && defects.length === 0;

  const card = {
    schemaVersion: 'portarium.evidence-card-input.v1',
    source: {
      system: 'prompt-language',
      area: 'harness-arena',
      manifestSchemaVersion: manifest.schemaVersion ?? null,
    },
    workItem: {
      id: manifest.taskId,
      runId: manifest.runId,
      runGroupId: manifest.runGroupId ?? null,
      policyVersion: manifest.policyVersion ?? null,
    },
    route: {
      arm: manifest.arm,
      decision: manifest.arm,
      selectedModel: firstStepValue(steps, 'actualModel') ?? firstStepValue(steps, 'requestedModel'),
      selectedProvider: firstStepValue(steps, 'provider'),
      reason: 'derived-from-harness-manifest',
    },
    gates: {
      finalVerdict: finalStatus,
      privateOracle: oraclePassed ? 'pass' : 'fail',
      blockingReviewDefects: defects,
    },
    cost: {
      frontierTokensTotal: frontierTokens(steps),
      cachedInputTokensTotal: cachedTokens(steps),
      providerUsdTotal: providerUsd(steps),
      localWallSecondsTotal: localWallSeconds(steps),
    },
    actionBoundary: {
      status: clearForResearch ? 'research-only' : 'blocked',
      reason: clearForResearch
        ? 'static evidence-card input only; product runtime ingestion remains blocked'
        : 'manifest is not eligible for product action',
    },
    artifactRefs: {
      manifest: 'hybrid-routing-manifest.json',
      oracleStdout: manifest.oracle.stdoutArtifactRef ?? null,
      oracleStderr: manifest.oracle.stderrArtifactRef ?? null,
    },
  };

  return { ok: true, errors: [], card };
}
`;

test('GSLR-3 private oracle passes a complete manifest transform', () => {
  const workspace = tempWorkspace();
  try {
    writeImplementation(workspace, validImplementation);
    const result = runOracle(workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /gslr3 private oracle passed/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('GSLR-3 private oracle rejects shallow transforms', () => {
  const workspace = tempWorkspace();
  try {
    writeImplementation(
      workspace,
      'export function buildEvidenceCardInput() { return { ok: true, errors: [], card: {} }; }\n',
    );
    const result = runOracle(workspace);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /bad frontier token sum|expected ok=false|card leaked/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

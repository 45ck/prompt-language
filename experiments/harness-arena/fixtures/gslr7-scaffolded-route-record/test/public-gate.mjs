import assert from 'node:assert/strict';

/* cspell:ignore apikey rawdump rawpayload sourcepayload studentpayload */

import {
  buildRouteDecisionRecord,
  containsUnsafeEvidenceText,
  deriveEscalationReasons,
  isSafeEvidenceRef,
  isUnsafeEvidenceKey,
  normalizeRouteKey,
  selectRouteDecision,
} from '../src/route-decision-record.mjs';

function validInput(overrides = {}) {
  return {
    schemaVersion: 'harness.route-input.v1',
    source: {
      system: 'prompt-language',
      area: 'harness-arena',
    },
    workItem: {
      id: 'gslr7-scaffolded-route-record',
      runId: 'gslr7-scaffolded-route-record-fake-live',
      runGroupId: 'gslr7-scaffolded-route-record',
      policyVersion: 'gslr-policy-schema-routing-v2',
    },
    route: {
      arm: 'local-only',
      selectedModel: 'qwen3-coder:30b',
      selectedProvider: 'ollama',
    },
    gates: {
      finalVerdict: 'pass',
      privateOracle: 'pass',
      blockingReviewDefects: [],
    },
    cost: {
      frontierTokensTotal: 0,
      providerUsdTotal: 0,
      localWallSecondsTotal: 52,
    },
    artifactRefs: {
      manifest: 'hybrid-routing-manifest.json',
      stepStdout: 'artifacts/steps/01-local-bulk/stdout.txt',
      oracleStdout: 'private/oracle/stdout.txt',
    },
    notes: 'extra caller notes must not be preserved',
    ...overrides,
  };
}

function expectPass(input, label, expectedDecision = 'local-screen') {
  const before = JSON.stringify(input);
  const result = buildRouteDecisionRecord(input);

  assert.equal(JSON.stringify(input), before, `${label}: input mutated`);
  assert.equal(result.ok, true, label);
  assert.deepEqual(result.errors, [], label);
  assert.ok(result.record, label);
  assert.equal(result.record.schemaVersion, 'portarium.route-decision-record.v1', label);
  assert.equal(result.record.selectedRoute.decision, expectedDecision, label);
  assert.equal(Object.hasOwn(result.record, 'notes'), false, label);
  return result.record;
}

function expectFail(input, label) {
  const result = buildRouteDecisionRecord(input);

  assert.equal(result.ok, false, label);
  assert.equal(result.record, null, label);
  assert.ok(Array.isArray(result.errors), label);
  assert.ok(result.errors.length > 0, label);
}

assert.equal(normalizeRouteKey('Oracle Command'), 'oraclecommand');
assert.equal(normalizeRouteKey('oracle_command'), 'oraclecommand');
assert.equal(isUnsafeEvidenceKey('oracle-command'), true);
assert.equal(isUnsafeEvidenceKey('safeSummary'), false);
assert.equal(containsUnsafeEvidenceText('BEGIN RAW PAYLOAD: student id 42'), true);
assert.equal(containsUnsafeEvidenceText('aggregate pass/fail counts only'), false);
assert.equal(isSafeEvidenceRef('artifacts/steps/01-local-bulk/stdout.txt'), true);
assert.equal(isSafeEvidenceRef('../private/raw-dump.json'), false);
assert.equal(isSafeEvidenceRef('hybrid-routing-manifest.json?raw=true'), false);

assert.deepEqual(deriveEscalationReasons(validInput()), []);
assert.deepEqual(
  deriveEscalationReasons(
    validInput({
      gates: {
        finalVerdict: 'fail',
        privateOracle: 'pass',
        blockingReviewDefects: ['missing assertion'],
      },
      cost: {
        frontierTokensTotal: 300,
        providerUsdTotal: 0.2,
        localWallSecondsTotal: 901,
      },
    }),
  ),
  [
    'public-gate-failure',
    'blocking-review-defects',
    'frontier-budget-used',
    'local-wall-time-high',
  ],
);

assert.equal(selectRouteDecision(validInput()).decision, 'local-screen');
assert.equal(
  selectRouteDecision(
    validInput({
      gates: {
        finalVerdict: 'pass',
        privateOracle: 'fail',
        blockingReviewDefects: [],
      },
    }),
  ).decision,
  'frontier-baseline',
);
assert.equal(
  selectRouteDecision(
    validInput({
      gates: {
        finalVerdict: 'fail',
        privateOracle: 'pass',
        blockingReviewDefects: [],
      },
    }),
  ).decision,
  'advisor-escalate',
);

const record = expectPass(validInput(), 'safe local route record passes');
assert.equal(record.workItem.id, 'gslr7-scaffolded-route-record');
assert.equal(record.selectedRoute.arm, 'local-only');
assert.equal(record.escalationReasons.length, 0);
assert.equal(record.artifactRefs.oracleStdout, 'private/oracle/stdout.txt');

expectPass(
  validInput({
    route: {
      arm: 'frontier-only',
      selectedModel: 'codex-default',
      selectedProvider: 'openai',
    },
  }),
  'frontier arm becomes frontier baseline',
  'frontier-baseline',
);

expectFail(null, 'null input fails');
expectFail([], 'array input fails');
expectFail(
  validInput({ metadata: { nested: [{ oracle_command: 'node private/oracle.mjs' }] } }),
  'separator-insensitive oracle command key fails',
);
expectFail(
  validInput({ summary: 'safe summary follows. BEGIN RAW PAYLOAD: student id 42' }),
  'raw payload boundary in text fails',
);
expectFail(
  validInput({
    artifactRefs: {
      manifest: '../private/raw-dump.json',
      stepStdout: 'artifacts/steps/01-local-bulk/stdout.txt',
      oracleStdout: 'private/oracle/stdout.txt',
    },
  }),
  'unsafe raw artifact path fails',
);

console.log('gslr7 public gate passed');

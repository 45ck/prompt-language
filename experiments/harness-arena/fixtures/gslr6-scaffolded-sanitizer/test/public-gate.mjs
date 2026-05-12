import assert from 'node:assert/strict';

/* cspell:ignore apikey rawdump rawpayload sourcepayload studentpayload */

import {
  containsRawPayloadText,
  deriveActionBoundary,
  isForbiddenRawKey,
  isSafeArtifactRef,
  normalizeEvidenceKey,
  sanitizeEvidenceCardInput,
} from '../src/evidence-card-sanitizer.mjs';

function validInput(overrides = {}) {
  return {
    schemaVersion: 'portarium.evidence-card-input.v1',
    source: {
      system: 'prompt-language',
      area: 'harness-arena',
      manifestSchemaVersion: 2,
    },
    workItem: {
      id: 'gslr6-scaffolded-sanitizer',
      runId: 'gslr6-scaffolded-sanitizer-fake-live',
      runGroupId: 'gslr6-scaffolded-sanitizer',
      policyVersion: 'gslr-policy-schema-routing-v2',
    },
    route: {
      arm: 'frontier-only',
      decision: 'frontier-baseline',
      selectedModel: 'codex-default',
      selectedProvider: 'openai',
      reason: 'scaffolded sanitizer baseline',
    },
    gates: {
      finalVerdict: 'pass',
      privateOracle: 'pass',
      blockingReviewDefects: [],
    },
    cost: {
      frontierTokensTotal: 7000,
      cachedInputTokensTotal: 2000,
      providerUsdTotal: 0.35,
      localWallSecondsTotal: 0,
    },
    actionBoundary: {
      status: 'blocked',
      reason: 'caller supplied stale boundary',
    },
    artifactRefs: {
      manifest: 'hybrid-routing-manifest.json',
      oracleStdout: 'private/oracle/stdout.txt',
      oracleStderr: 'private/oracle/stderr.txt',
    },
    notes: 'extra caller notes must not be preserved',
    ...overrides,
  };
}

function expectPass(input, label, expectedBoundary = 'research-only') {
  const before = JSON.stringify(input);
  const result = sanitizeEvidenceCardInput(input);

  assert.equal(JSON.stringify(input), before, `${label}: input mutated`);
  assert.equal(result.ok, true, label);
  assert.deepEqual(result.errors, [], label);
  assert.ok(result.card, label);
  assert.equal(result.card.schemaVersion, 'portarium.evidence-card-input.v1', label);
  assert.equal(result.card.actionBoundary.status, expectedBoundary, label);
  assert.equal(Object.hasOwn(result.card, 'notes'), false, label);
  return result.card;
}

function expectFail(input, label) {
  const result = sanitizeEvidenceCardInput(input);

  assert.equal(result.ok, false, label);
  assert.equal(result.card, null, label);
  assert.ok(Array.isArray(result.errors), label);
  assert.ok(result.errors.length > 0, label);
}

assert.equal(normalizeEvidenceKey('Source Payload'), 'sourcepayload');
assert.equal(normalizeEvidenceKey('source_payload'), 'sourcepayload');
assert.equal(isForbiddenRawKey('source-payload'), true);
assert.equal(isForbiddenRawKey('safeSummary'), false);
assert.equal(containsRawPayloadText('BEGIN RAW PAYLOAD: student id 42'), true);
assert.equal(containsRawPayloadText('aggregate pass/fail counts only'), false);
assert.equal(isSafeArtifactRef('private/oracle/stdout.txt'), true);
assert.equal(isSafeArtifactRef('../private/raw-dump.json'), false);
assert.equal(isSafeArtifactRef('/tmp/rawdump.json'), false);

assert.equal(
  deriveActionBoundary({ finalVerdict: 'pass', privateOracle: 'pass', blockingReviewDefects: [] })
    .status,
  'research-only',
);
assert.equal(
  deriveActionBoundary({ finalVerdict: 'pass', privateOracle: 'fail', blockingReviewDefects: [] })
    .status,
  'blocked',
);

const card = expectPass(validInput(), 'safe static evidence card passes');
assert.equal(card.source.system, 'prompt-language');
assert.equal(card.workItem.id, 'gslr6-scaffolded-sanitizer');
assert.equal(card.route.arm, 'frontier-only');
assert.equal(card.artifactRefs.oracleStdout, 'private/oracle/stdout.txt');

expectPass(
  validInput({
    gates: {
      finalVerdict: 'fail',
      privateOracle: 'pass',
      blockingReviewDefects: [],
    },
  }),
  'failed verdict becomes blocked card',
  'blocked',
);

expectFail(null, 'null input fails');
expectFail([], 'array input fails');
expectFail(
  validInput({ metadata: { nested: [{ 'Source Payload': { hidden: true } }] } }),
  'separator-insensitive raw payload key fails',
);
expectFail(
  validInput({ summary: 'safe summary follows. BEGIN RAW PAYLOAD: student id 42' }),
  'raw payload boundary in text fails',
);
expectFail(
  validInput({
    artifactRefs: {
      manifest: '../private/raw-dump.json',
      oracleStdout: 'private/oracle/stdout.txt',
      oracleStderr: 'private/oracle/stderr.txt',
    },
  }),
  'unsafe raw artifact path fails',
);

console.log('gslr6 public gate passed');

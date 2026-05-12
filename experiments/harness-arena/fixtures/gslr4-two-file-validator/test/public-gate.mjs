import assert from 'node:assert/strict';

/* cspell:ignore sourcepayload */

import { deriveActionBoundary } from '../src/action-boundary-policy.mjs';
import { validateEngineeringEvidenceCard } from '../src/evidence-card-validator.mjs';

function validCard(overrides = {}) {
  return {
    schemaVersion: 'portarium.evidence-card-input.v1',
    source: {
      system: 'prompt-language',
      area: 'harness-arena',
      manifestSchemaVersion: 2,
    },
    workItem: {
      id: 'gslr4-two-file-validator',
      runId: 'gslr4-two-file-validator-fake-live',
      runGroupId: 'gslr4-two-file-validator',
      policyVersion: 'gslr-policy-schema-routing-v2',
    },
    route: {
      arm: 'frontier-only',
      decision: 'frontier-baseline',
      selectedModel: 'codex-default',
      selectedProvider: 'openai',
      reason: 'derived-from-harness-manifest',
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
      status: 'research-only',
      reason: 'static evidence-card input only; product runtime ingestion remains blocked',
    },
    artifactRefs: {
      manifest: 'hybrid-routing-manifest.json',
      oracleStdout: 'private/oracle/stdout.txt',
      oracleStderr: 'private/oracle/stderr.txt',
    },
    ...overrides,
  };
}

function expectPass(card, label) {
  const before = JSON.stringify(card);
  const result = validateEngineeringEvidenceCard(card);

  assert.equal(JSON.stringify(card), before, `${label}: input mutated`);
  assert.equal(result.ok, true, label);
  assert.deepEqual(result.errors, [], label);
}

function expectFail(card, label) {
  const result = validateEngineeringEvidenceCard(card);

  assert.equal(result.ok, false, label);
  assert.ok(Array.isArray(result.errors), label);
  assert.ok(result.errors.length > 0, label);
}

expectPass(validCard(), 'valid frontier-baseline research card passes');

expectPass(
  validCard({
    route: {
      arm: 'local-only',
      decision: 'local-screen',
      selectedModel: 'qwen3-coder:30b',
      selectedProvider: 'ollama',
      reason: 'local public gate failed',
    },
    gates: {
      finalVerdict: 'fail',
      privateOracle: 'fail',
      blockingReviewDefects: ['public gate failed'],
    },
    cost: {
      frontierTokensTotal: 0,
      cachedInputTokensTotal: 0,
      providerUsdTotal: 0,
      localWallSecondsTotal: 31.5,
    },
    actionBoundary: {
      status: 'blocked',
      reason: 'manifest is not eligible for product action',
    },
  }),
  'blocked failed local card passes',
);

expectFail(
  validCard({
    gates: {
      finalVerdict: 'pass',
      privateOracle: 'fail',
      blockingReviewDefects: [],
    },
  }),
  'research-only card with failed oracle fails',
);

expectFail(
  validCard({
    metadata: { nested: [{ sourcePayload: { hidden: true } }] },
  }),
  'nested source payload fails',
);

expectFail(
  validCard({
    artifactRefs: {
      manifest: 'hybrid-routing-manifest.json?raw=true',
      oracleStdout: 'private/oracle/stdout.txt',
      oracleStderr: 'private/oracle/stderr.txt',
    },
  }),
  'artifact ref query fails',
);

assert.equal(deriveActionBoundary(validCard()).status, 'research-only');
assert.equal(
  deriveActionBoundary(
    validCard({
      gates: {
        finalVerdict: 'fail',
        privateOracle: 'pass',
        blockingReviewDefects: [],
      },
    }),
  ).status,
  'blocked',
);

console.log('gslr4 public gate passed');

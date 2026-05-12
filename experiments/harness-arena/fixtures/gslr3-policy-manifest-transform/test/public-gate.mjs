import assert from 'node:assert/strict';

import { buildEvidenceCardInput } from '../src/evidence-card-transform.mjs';

function validManifest(overrides = {}) {
  return {
    schemaVersion: 2,
    runId: 'gslr3-policy-manifest-transform-fake-live',
    runGroupId: 'gslr3-policy-manifest-transform',
    taskId: 'gslr3-policy-manifest-transform',
    policyVersion: 'gslr-policy-schema-routing-v1',
    arm: 'local-only',
    finalVerdict: { status: 'pass', reasons: [] },
    oracle: {
      passed: true,
      stdoutArtifactRef: 'private/oracle/stdout.txt',
      stderrArtifactRef: 'private/oracle/stderr.txt',
    },
    steps: [
      {
        stepId: 'local-bulk',
        routeDecision: 'local',
        provider: 'ollama',
        requestedModel: 'qwen3-coder:30b',
        actualModel: 'qwen3-coder:30b',
        frontierCallKind: 'none',
        wallSeconds: 12.25,
        reviewDefects: [],
        cost: {
          totalTokens: null,
          cachedInputTokens: null,
          providerReportedUsd: null,
        },
      },
    ],
    ...overrides,
  };
}

function expectPass(manifest, label) {
  const before = JSON.stringify(manifest);
  const result = buildEvidenceCardInput(manifest);

  assert.equal(JSON.stringify(manifest), before, `${label}: input mutated`);
  assert.equal(result.ok, true, label);
  assert.deepEqual(result.errors, [], label);
  assert.equal(result.card.schemaVersion, 'portarium.evidence-card-input.v1', label);
  return result.card;
}

function expectFail(manifest, label) {
  const result = buildEvidenceCardInput(manifest);

  assert.equal(result.ok, false, label);
  assert.equal(result.card, null, label);
  assert.ok(Array.isArray(result.errors), label);
  assert.ok(result.errors.length > 0, label);
}

const localCard = expectPass(validManifest(), 'local manifest transforms');
assert.equal(localCard.source.system, 'prompt-language');
assert.equal(localCard.source.area, 'harness-arena');
assert.equal(localCard.workItem.id, 'gslr3-policy-manifest-transform');
assert.equal(localCard.workItem.runId, 'gslr3-policy-manifest-transform-fake-live');
assert.equal(localCard.route.decision, 'local-only');
assert.equal(localCard.route.selectedModel, 'qwen3-coder:30b');
assert.equal(localCard.gates.finalVerdict, 'pass');
assert.equal(localCard.gates.privateOracle, 'pass');
assert.deepEqual(localCard.gates.blockingReviewDefects, []);
assert.equal(localCard.cost.frontierTokensTotal, 0);
assert.equal(localCard.cost.localWallSecondsTotal, 12.25);
assert.equal(localCard.actionBoundary.status, 'research-only');
assert.equal(localCard.artifactRefs.oracleStdout, 'private/oracle/stdout.txt');

const frontierCard = expectPass(
  validManifest({
    arm: 'frontier-only',
    steps: [
      {
        stepId: 'frontier-full',
        routeDecision: 'frontier',
        provider: 'openai',
        requestedModel: 'codex-default',
        actualModel: 'codex-default',
        frontierCallKind: 'full-work',
        wallSeconds: 18.5,
        reviewDefects: [],
        cost: {
          totalTokens: 9000,
          cachedInputTokens: 3000,
          providerReportedUsd: 0.42,
        },
      },
    ],
  }),
  'frontier manifest transforms with token totals',
);
assert.equal(frontierCard.cost.frontierTokensTotal, 9000);
assert.equal(frontierCard.cost.cachedInputTokensTotal, 3000);
assert.equal(frontierCard.cost.providerUsdTotal, 0.42);
assert.equal(frontierCard.cost.localWallSecondsTotal, 0);

expectFail(null, 'null manifest fails');
expectFail([], 'array manifest fails');
const failedCard = expectPass(
  validManifest({ finalVerdict: { status: 'fail' } }),
  'failed final verdict transforms to a blocked card',
);
assert.equal(failedCard.gates.finalVerdict, 'fail');
assert.equal(failedCard.actionBoundary.status, 'blocked');
const reviewBlockedCard = expectPass(
  validManifest({
    steps: [
      {
        stepId: 'frontier-review',
        routeDecision: 'frontier',
        provider: 'openai',
        requestedModel: 'codex-default',
        actualModel: 'codex-default',
        frontierCallKind: 'review',
        wallSeconds: 8,
        reviewDefects: ['raw payload boundary unclear'],
        cost: {
          totalTokens: 1200,
          cachedInputTokens: 200,
          providerReportedUsd: 0.12,
        },
      },
    ],
  }),
  'blocking review defects transform to a blocked card',
);
assert.deepEqual(reviewBlockedCard.gates.blockingReviewDefects, ['raw payload boundary unclear']);
assert.equal(reviewBlockedCard.actionBoundary.status, 'blocked');
expectFail(
  validManifest({ metadata: { sourcePayload: { hidden: true } } }),
  'source payload leakage fails',
);

console.log('gslr3 public gate passed');

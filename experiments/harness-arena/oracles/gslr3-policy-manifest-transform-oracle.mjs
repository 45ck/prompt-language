#!/usr/bin/env node

/* cspell:ignore sourcepayload studentpayload */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const options = { workspace: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--workspace') {
      options.workspace = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.workspace) throw new Error('--workspace is required');
  return options;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validManifest(overrides = {}) {
  return {
    schemaVersion: 2,
    runId: 'gslr3-policy-manifest-transform-live',
    runGroupId: 'gslr3-policy-manifest-transform',
    taskId: 'gslr3-policy-manifest-transform',
    policyVersion: 'gslr-policy-schema-routing-v1',
    arm: 'hybrid-router',
    finalVerdict: { status: 'pass', reasons: [] },
    oracle: {
      passed: true,
      stdoutArtifactRef: 'private/oracle/stdout.txt',
      stderrArtifactRef: 'private/oracle/stderr.txt',
    },
    steps: [
      {
        stepId: 'frontier-classify',
        routeDecision: 'frontier',
        provider: 'openai',
        requestedModel: 'codex-default',
        actualModel: 'codex-default',
        frontierCallKind: 'classifier',
        wallSeconds: 2.5,
        reviewDefects: [],
        cost: {
          totalTokens: 1200,
          cachedInputTokens: 400,
          providerReportedUsd: 0.05,
        },
      },
      {
        stepId: 'local-bulk',
        routeDecision: 'local',
        provider: 'ollama',
        requestedModel: 'qwen3-coder:30b',
        actualModel: 'qwen3-coder:30b',
        frontierCallKind: 'none',
        wallSeconds: 10.25,
        reviewDefects: [],
        cost: {
          totalTokens: null,
          cachedInputTokens: null,
          providerReportedUsd: null,
        },
      },
      {
        stepId: 'frontier-review',
        routeDecision: 'frontier',
        provider: 'openai',
        requestedModel: 'codex-default',
        actualModel: 'codex-default',
        frontierCallKind: 'review',
        wallSeconds: 3.75,
        reviewDefects: [],
        cost: {
          totalTokens: 1800,
          cachedInputTokens: 600,
          providerReportedUsd: 0.07,
        },
      },
    ],
    ...overrides,
  };
}

async function loadTransform(workspace) {
  const modulePath = join(workspace, 'src', 'evidence-card-transform.mjs');
  if (!existsSync(modulePath)) fail('missing src/evidence-card-transform.mjs');

  const moduleUrl = pathToFileURL(modulePath);
  moduleUrl.search = `?oracle=${Date.now()}-${Math.random()}`;
  const module = await import(moduleUrl.href);
  if (typeof module.buildEvidenceCardInput !== 'function') {
    fail('missing buildEvidenceCardInput export');
  }
  return module.buildEvidenceCardInput;
}

function assertResultShape(result, label) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    fail(`${label}: result is not an object`);
  }
  if (typeof result.ok !== 'boolean') fail(`${label}: result.ok is not boolean`);
  if (!Array.isArray(result.errors)) fail(`${label}: result.errors is not an array`);
  if (!result.errors.every((error) => typeof error === 'string' && error.length > 0)) {
    fail(`${label}: errors must be non-empty strings`);
  }
  if (
    result.ok &&
    (!result.card || typeof result.card !== 'object' || Array.isArray(result.card))
  ) {
    fail(`${label}: pass result did not return a card object`);
  }
  if (!result.ok && result.card !== null) fail(`${label}: fail result must return card null`);
}

function check(transform, manifest, expectedOk, label) {
  const input = clone(manifest);
  const before = JSON.stringify(input);
  const result = transform(input);

  assertResultShape(result, label);
  if (JSON.stringify(input) !== before) fail(`${label}: transform mutated input`);
  if (result.ok !== expectedOk) fail(`${label}: expected ok=${expectedOk}`);
  if (expectedOk && result.errors.length !== 0) fail(`${label}: pass result returned errors`);
  if (!expectedOk && result.errors.length === 0) fail(`${label}: fail result returned no errors`);
  return result.card;
}

function assertNoForbiddenCardText(card, label) {
  const text = JSON.stringify(card).toLowerCase();
  for (const forbidden of ['sourcepayload', 'studentpayload', 'credential', 'secret', 'password']) {
    if (text.includes(forbidden)) fail(`${label}: card leaked ${forbidden}`);
  }
}

const { workspace } = parseArgs(process.argv.slice(2));
const transform = await loadTransform(workspace);

const card = check(transform, validManifest(), true, 'valid hybrid manifest');
if (card.cost.frontierTokensTotal !== 3000) fail('valid hybrid manifest: bad frontier token sum');
if (card.cost.cachedInputTokensTotal !== 1000) fail('valid hybrid manifest: bad cached token sum');
if (card.cost.localWallSecondsTotal !== 10.25) fail('valid hybrid manifest: bad local wall sum');
if (card.actionBoundary.status !== 'research-only') {
  fail('valid hybrid manifest: action boundary should be research-only');
}
assertNoForbiddenCardText(card, 'valid hybrid manifest');

check(transform, null, false, 'null manifest rejected without throwing');
check(transform, [], false, 'array manifest rejected without throwing');
const failedCard = check(
  transform,
  validManifest({ finalVerdict: { status: 'fail' } }),
  true,
  'failed final verdict becomes blocked evidence',
);
if (failedCard.actionBoundary.status !== 'blocked') {
  fail('failed final verdict: action boundary should be blocked');
}
const failedOracleCard = check(
  transform,
  validManifest({ oracle: { passed: false } }),
  true,
  'failed oracle becomes blocked evidence',
);
if (failedOracleCard.gates.privateOracle !== 'fail') {
  fail('failed oracle: private oracle gate should be fail');
}
if (failedOracleCard.actionBoundary.status !== 'blocked') {
  fail('failed oracle: action boundary should be blocked');
}
const defectCard = check(
  transform,
  validManifest({
    steps: [
      {
        stepId: 'frontier-review',
        routeDecision: 'frontier',
        provider: 'openai',
        requestedModel: 'codex-default',
        actualModel: 'codex-default',
        frontierCallKind: 'review',
        wallSeconds: 4,
        reviewDefects: ['raw payload handling is ambiguous'],
        cost: { totalTokens: 1000, cachedInputTokens: 0, providerReportedUsd: 0.1 },
      },
    ],
  }),
  true,
  'blocking review defect becomes blocked evidence',
);
if (defectCard.actionBoundary.status !== 'blocked') {
  fail('blocking review defect: action boundary should be blocked');
}
if (defectCard.gates.blockingReviewDefects.length !== 1) {
  fail('blocking review defect: card did not preserve defect summary');
}
check(
  transform,
  validManifest({ metadata: { nested: [{ sourcePayload: { id: 'hidden' } }] } }),
  false,
  'nested sourcePayload rejected',
);
check(
  transform,
  validManifest({ context: { studentPayload: { id: 'student-1' } } }),
  false,
  'student payload rejected',
);
check(
  transform,
  validManifest({ context: { approval: { credential: 'do-not-copy' } } }),
  false,
  'credential rejected',
);

console.log('gslr3 private oracle passed');

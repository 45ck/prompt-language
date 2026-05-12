#!/usr/bin/env node

/* cspell:ignore apikey rawdump rawpayload rawstderr rawstdout sourcepayload studentpayload */

import { existsSync, readFileSync } from 'node:fs';
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
      runId: 'gslr6-scaffolded-sanitizer-live',
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
    ...overrides,
  };
}

async function importFresh(modulePath) {
  const moduleUrl = pathToFileURL(modulePath);
  moduleUrl.search = `?oracle=${Date.now()}-${Math.random()}`;
  return import(moduleUrl.href);
}

async function loadWorkspace(workspace) {
  const sanitizerPath = join(workspace, 'src', 'evidence-card-sanitizer.mjs');
  if (!existsSync(sanitizerPath)) fail('missing src/evidence-card-sanitizer.mjs');

  const source = readFileSync(sanitizerPath, 'utf8');
  for (const name of [
    'normalizeEvidenceKey',
    'isForbiddenRawKey',
    'containsRawPayloadText',
    'isSafeArtifactRef',
    'deriveActionBoundary',
    'sanitizeEvidenceCardInput',
  ]) {
    if (!source.includes(`export function ${name}`) && !source.includes(`export { ${name}`)) {
      fail(`missing exported helper boundary: ${name}`);
    }
  }

  const module = await importFresh(sanitizerPath);
  for (const name of [
    'normalizeEvidenceKey',
    'isForbiddenRawKey',
    'containsRawPayloadText',
    'isSafeArtifactRef',
    'deriveActionBoundary',
    'sanitizeEvidenceCardInput',
  ]) {
    if (typeof module[name] !== 'function') fail(`missing ${name} export`);
  }
  return module;
}

function assertResultShape(result, label) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    fail(`${label}: result is not an object`);
  }
  if (typeof result.ok !== 'boolean') fail(`${label}: result.ok is not boolean`);
  if (!Array.isArray(result.errors)) fail(`${label}: errors is not an array`);
  if (result.ok && result.card === null) fail(`${label}: passing result returned null card`);
  if (!result.ok && result.card !== null) fail(`${label}: failing result returned a card`);
}

function check(sanitizeEvidenceCardInput, input, expectedOk, label) {
  const clonedInput = clone(input);
  const before = JSON.stringify(clonedInput);
  let result;
  try {
    result = sanitizeEvidenceCardInput(clonedInput);
  } catch (error) {
    fail(`${label}: sanitizer threw ${error instanceof Error ? error.message : String(error)}`);
  }
  assertResultShape(result, label);
  if (JSON.stringify(clonedInput) !== before) fail(`${label}: sanitizer mutated input`);
  if (result.ok !== expectedOk) fail(`${label}: expected ok=${expectedOk}`);
  if (expectedOk && result.errors.length !== 0) fail(`${label}: pass returned errors`);
  if (!expectedOk && result.errors.length === 0) fail(`${label}: fail returned no errors`);
  return result.card;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected)
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const { workspace } = parseArgs(process.argv.slice(2));
const module = await loadWorkspace(workspace);

assertEqual(module.normalizeEvidenceKey('Source Payload'), 'sourcepayload', 'normalizes spaces');
assertEqual(
  module.normalizeEvidenceKey('source_payload'),
  'sourcepayload',
  'normalizes underscores',
);
assertEqual(module.normalizeEvidenceKey('source-payload'), 'sourcepayload', 'normalizes hyphens');
assertEqual(module.isForbiddenRawKey('source payload'), true, 'forbidden source payload key');
assertEqual(module.isForbiddenRawKey('api-key'), true, 'forbidden api key');
assertEqual(module.isForbiddenRawKey('safeSummary'), false, 'allows safe summary key');
assertEqual(
  module.containsRawPayloadText('BEGIN RAW PAYLOAD: student identifier 42'),
  true,
  'raw text match',
);
assertEqual(module.containsRawPayloadText('Aggregate counts only.'), false, 'safe text not raw');
assertEqual(
  module.isSafeArtifactRef('private/oracle/stdout.txt'),
  true,
  'safe relative artifact ref',
);
assertEqual(
  module.isSafeArtifactRef('artifacts/steps/01-local-bulk/stdout.txt'),
  true,
  'safe step artifact ref',
);
assertEqual(
  module.isSafeArtifactRef('../private/raw-dump.json'),
  false,
  'parent traversal artifact ref',
);
assertEqual(module.isSafeArtifactRef('/tmp/rawdump.json'), false, 'absolute raw dump artifact ref');
assertEqual(
  module.isSafeArtifactRef('hybrid-routing-manifest.json?raw=true'),
  false,
  'query artifact ref',
);

const derivedClear = module.deriveActionBoundary({
  finalVerdict: 'pass',
  privateOracle: 'pass',
  blockingReviewDefects: [],
});
assertEqual(derivedClear?.status, 'research-only', 'clear gates derive research-only');
const derivedBlocked = module.deriveActionBoundary({
  finalVerdict: 'pass',
  privateOracle: 'fail',
  blockingReviewDefects: [],
});
assertEqual(derivedBlocked?.status, 'blocked', 'failed oracle derives blocked');

const safeCard = check(module.sanitizeEvidenceCardInput, validInput(), true, 'safe card');
if (!safeCard.actionBoundary || safeCard.actionBoundary.status !== 'research-only') {
  fail('safe card: action boundary was not recomputed to research-only');
}
if (Object.hasOwn(safeCard, 'notes') || Object.hasOwn(safeCard, 'metadata')) {
  fail('safe card: unexpected extra top-level fields were preserved');
}

const blockedCard = check(
  module.sanitizeEvidenceCardInput,
  validInput({ gates: { finalVerdict: 'pass', privateOracle: 'fail', blockingReviewDefects: [] } }),
  true,
  'failed oracle card',
);
if (!blockedCard.actionBoundary || blockedCard.actionBoundary.status !== 'blocked') {
  fail('failed oracle card: action boundary was not blocked');
}

check(module.sanitizeEvidenceCardInput, null, false, 'null rejected without throwing');
check(module.sanitizeEvidenceCardInput, [], false, 'array rejected without throwing');
check(
  module.sanitizeEvidenceCardInput,
  validInput({ schemaVersion: 'portarium.evidence-card-input.v0' }),
  false,
  'unsupported schema rejected',
);
check(
  module.sanitizeEvidenceCardInput,
  validInput({ metadata: { nested: [{ 'Source Payload': { hidden: true } }] } }),
  false,
  'separator-insensitive source payload key rejected',
);
check(
  module.sanitizeEvidenceCardInput,
  validInput({ metadata: { nested: [{ 'api-key': 'sk-not-real' }] } }),
  false,
  'separator-insensitive api key rejected',
);
check(
  module.sanitizeEvidenceCardInput,
  validInput({ summary: 'Reviewer said this is safe; hidden oracle body: copy it.' }),
  false,
  'hidden oracle body text rejected',
);
check(
  module.sanitizeEvidenceCardInput,
  validInput({ summary: 'Aggregate only, but raw transcript appears in a footnote.' }),
  false,
  'raw transcript text rejected',
);
check(
  module.sanitizeEvidenceCardInput,
  validInput({
    artifactRefs: {
      manifest: '/tmp/rawdump.json',
      oracleStdout: 'private/oracle/stdout.txt',
      oracleStderr: 'private/oracle/stderr.txt',
    },
  }),
  false,
  'absolute raw dump artifact rejected',
);

console.log('gslr6 private oracle passed');

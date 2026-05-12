#!/usr/bin/env node

/* cspell:ignore rawpayload sourcepayload studentpayload */

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
      runId: 'gslr4-two-file-validator-live',
      runGroupId: 'gslr4-two-file-validator',
      policyVersion: 'gslr-policy-schema-routing-v2',
    },
    route: {
      arm: 'hybrid-router',
      decision: 'advisor-only',
      selectedModel: 'qwen3-coder:30b',
      selectedProvider: 'ollama',
      reason: 'advisor classified cross-file validation as local-eligible',
    },
    gates: {
      finalVerdict: 'pass',
      privateOracle: 'pass',
      blockingReviewDefects: [],
    },
    cost: {
      frontierTokensTotal: 2500,
      cachedInputTokensTotal: 512,
      providerUsdTotal: 0.18,
      localWallSecondsTotal: 22.75,
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

async function importFresh(modulePath) {
  const moduleUrl = pathToFileURL(modulePath);
  moduleUrl.search = `?oracle=${Date.now()}-${Math.random()}`;
  return import(moduleUrl.href);
}

async function loadWorkspace(workspace) {
  const actionPath = join(workspace, 'src', 'action-boundary-policy.mjs');
  const validatorPath = join(workspace, 'src', 'evidence-card-validator.mjs');
  if (!existsSync(actionPath)) fail('missing src/action-boundary-policy.mjs');
  if (!existsSync(validatorPath)) fail('missing src/evidence-card-validator.mjs');

  const validatorSource = readFileSync(validatorPath, 'utf8');
  if (
    !validatorSource.includes('action-boundary-policy.mjs') ||
    !validatorSource.includes('deriveActionBoundary')
  ) {
    fail('validator must import and use deriveActionBoundary from action-boundary-policy.mjs');
  }

  const actionModule = await importFresh(actionPath);
  const validatorModule = await importFresh(validatorPath);
  if (typeof actionModule.deriveActionBoundary !== 'function') {
    fail('missing deriveActionBoundary export');
  }
  if (typeof validatorModule.validateEngineeringEvidenceCard !== 'function') {
    fail('missing validateEngineeringEvidenceCard export');
  }

  return {
    deriveActionBoundary: actionModule.deriveActionBoundary,
    validateEngineeringEvidenceCard: validatorModule.validateEngineeringEvidenceCard,
  };
}

function assertBoundaryShape(result, label) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    fail(`${label}: boundary result is not an object`);
  }
  if (!['research-only', 'blocked'].includes(result.status)) {
    fail(`${label}: boundary status is invalid`);
  }
  if (typeof result.reason !== 'string' || !result.reason.trim()) {
    fail(`${label}: boundary reason is required`);
  }
}

function assertValidatorShape(result, label) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    fail(`${label}: validator result is not an object`);
  }
  if (typeof result.ok !== 'boolean') fail(`${label}: result.ok is not boolean`);
  if (!Array.isArray(result.errors)) fail(`${label}: result.errors is not an array`);
  if (!result.errors.every((error) => typeof error === 'string' && error.length > 0)) {
    fail(`${label}: errors must be non-empty strings`);
  }
}

function checkBoundary(deriveActionBoundary, card, expectedStatus, label) {
  const result = deriveActionBoundary(card);
  assertBoundaryShape(result, label);
  if (result.status !== expectedStatus) fail(`${label}: expected ${expectedStatus}`);
}

function checkValidator(validateEngineeringEvidenceCard, card, expectedOk, label) {
  const input = clone(card);
  const before = JSON.stringify(input);
  let result;
  try {
    result = validateEngineeringEvidenceCard(input);
  } catch (error) {
    fail(`${label}: validator threw ${error instanceof Error ? error.message : String(error)}`);
  }
  assertValidatorShape(result, label);
  if (JSON.stringify(input) !== before) fail(`${label}: validator mutated input`);
  if (result.ok !== expectedOk) fail(`${label}: expected ok=${expectedOk}`);
  if (expectedOk && result.errors.length !== 0) fail(`${label}: pass returned errors`);
  if (!expectedOk && result.errors.length === 0) fail(`${label}: fail returned no errors`);
}

const { workspace } = parseArgs(process.argv.slice(2));
const { deriveActionBoundary, validateEngineeringEvidenceCard } = await loadWorkspace(workspace);

checkBoundary(deriveActionBoundary, validCard(), 'research-only', 'valid boundary');
checkBoundary(
  deriveActionBoundary,
  validCard({ gates: { finalVerdict: 'fail', privateOracle: 'pass', blockingReviewDefects: [] } }),
  'blocked',
  'failed final verdict boundary',
);
checkBoundary(
  deriveActionBoundary,
  validCard({
    gates: { finalVerdict: 'pass', privateOracle: 'pass', blockingReviewDefects: ['defect'] },
  }),
  'blocked',
  'blocking review defect boundary',
);

checkValidator(validateEngineeringEvidenceCard, validCard(), true, 'valid card');
checkValidator(
  validateEngineeringEvidenceCard,
  validCard({
    gates: {
      finalVerdict: 'fail',
      privateOracle: 'fail',
      blockingReviewDefects: ['public gate failed'],
    },
    actionBoundary: { status: 'blocked', reason: 'manifest is not eligible for product action' },
  }),
  true,
  'blocked failed card remains valid',
);
checkValidator(validateEngineeringEvidenceCard, null, false, 'null rejected without throwing');
checkValidator(validateEngineeringEvidenceCard, [], false, 'array rejected without throwing');
checkValidator(
  validateEngineeringEvidenceCard,
  validCard({ schemaVersion: 'portarium.evidence-card-input.v0' }),
  false,
  'unsupported schema rejected',
);
checkValidator(
  validateEngineeringEvidenceCard,
  validCard({ source: { system: 'other', area: 'harness-arena', manifestSchemaVersion: 2 } }),
  false,
  'unsupported source system rejected',
);
checkValidator(
  validateEngineeringEvidenceCard,
  validCard({ workItem: { id: '', runId: 'run' } }),
  false,
  'missing work item id rejected',
);
checkValidator(
  validateEngineeringEvidenceCard,
  validCard({ route: { arm: 'unknown', decision: 'unknown' } }),
  false,
  'unknown route arm rejected',
);
checkValidator(
  validateEngineeringEvidenceCard,
  validCard({
    cost: {
      frontierTokensTotal: -1,
      cachedInputTokensTotal: 0,
      providerUsdTotal: 0,
      localWallSecondsTotal: 0,
    },
  }),
  false,
  'negative cost rejected',
);
checkValidator(
  validateEngineeringEvidenceCard,
  validCard({
    artifactRefs: {
      manifest: 'hybrid-routing-manifest.json#hidden',
      oracleStdout: 'private/oracle/stdout.txt',
      oracleStderr: 'private/oracle/stderr.txt',
    },
  }),
  false,
  'artifact fragment rejected',
);
checkValidator(
  validateEngineeringEvidenceCard,
  validCard({ metadata: { nested: [{ rawPayload: { hidden: true } }] } }),
  false,
  'recursive raw payload rejected',
);
checkValidator(
  validateEngineeringEvidenceCard,
  validCard({ metadata: { approval: { credential: 'do-not-copy' } } }),
  false,
  'credential rejected',
);
checkValidator(
  validateEngineeringEvidenceCard,
  validCard({
    gates: { finalVerdict: 'pass', privateOracle: 'fail', blockingReviewDefects: [] },
  }),
  false,
  'research-only mismatch rejected',
);

console.log('gslr4 private oracle passed');

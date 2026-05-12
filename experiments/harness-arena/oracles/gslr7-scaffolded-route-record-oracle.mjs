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
    schemaVersion: 'harness.route-input.v1',
    source: {
      system: 'prompt-language',
      area: 'harness-arena',
    },
    workItem: {
      id: 'gslr7-scaffolded-route-record',
      runId: 'gslr7-scaffolded-route-record-live',
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
    ...overrides,
  };
}

async function importFresh(modulePath) {
  const moduleUrl = pathToFileURL(modulePath);
  moduleUrl.search = `?oracle=${Date.now()}-${Math.random()}`;
  return import(moduleUrl.href);
}

async function loadWorkspace(workspace) {
  const targetPath = join(workspace, 'src', 'route-decision-record.mjs');
  if (!existsSync(targetPath)) fail('missing src/route-decision-record.mjs');

  const source = readFileSync(targetPath, 'utf8');
  if (/from\s+['"].*route-decision-record\.mjs['"]/i.test(source)) {
    fail('route-decision-record implementation must not self-import');
  }
  for (const name of [
    'normalizeRouteKey',
    'isUnsafeEvidenceKey',
    'containsUnsafeEvidenceText',
    'isSafeEvidenceRef',
    'deriveEscalationReasons',
    'selectRouteDecision',
    'buildRouteDecisionRecord',
  ]) {
    if (!source.includes(`export function ${name}`) && !source.includes(`export { ${name}`)) {
      fail(`missing exported helper boundary: ${name}`);
    }
  }

  const module = await importFresh(targetPath);
  for (const name of [
    'normalizeRouteKey',
    'isUnsafeEvidenceKey',
    'containsUnsafeEvidenceText',
    'isSafeEvidenceRef',
    'deriveEscalationReasons',
    'selectRouteDecision',
    'buildRouteDecisionRecord',
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
  if (result.ok && result.record === null) fail(`${label}: passing result returned null record`);
  if (!result.ok && result.record !== null) fail(`${label}: failing result returned a record`);
}

function check(buildRouteDecisionRecord, input, expectedOk, label) {
  const clonedInput = clone(input);
  const before = JSON.stringify(clonedInput);
  let result;
  try {
    result = buildRouteDecisionRecord(clonedInput);
  } catch (error) {
    fail(`${label}: builder threw ${error instanceof Error ? error.message : String(error)}`);
  }
  assertResultShape(result, label);
  if (JSON.stringify(clonedInput) !== before) fail(`${label}: builder mutated input`);
  if (result.ok !== expectedOk) fail(`${label}: expected ok=${expectedOk}`);
  if (expectedOk && result.errors.length !== 0) fail(`${label}: pass returned errors`);
  if (!expectedOk && result.errors.length === 0) fail(`${label}: fail returned no errors`);
  return result.record;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected)
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertDeepEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const { workspace } = parseArgs(process.argv.slice(2));
const module = await loadWorkspace(workspace);

assertEqual(module.normalizeRouteKey('Oracle Command'), 'oraclecommand', 'normalizes spaces');
assertEqual(module.normalizeRouteKey('oracle_command'), 'oraclecommand', 'normalizes underscores');
assertEqual(module.normalizeRouteKey('oracle-command'), 'oraclecommand', 'normalizes hyphens');
assertEqual(module.isUnsafeEvidenceKey('oracle command'), true, 'forbidden oracle command key');
assertEqual(module.isUnsafeEvidenceKey('api-key'), true, 'forbidden api key');
assertEqual(module.isUnsafeEvidenceKey('safeSummary'), false, 'allows safe summary key');
assertEqual(
  module.containsUnsafeEvidenceText('BEGIN RAW PAYLOAD: student identifier 42'),
  true,
  'raw text match',
);
assertEqual(
  module.containsUnsafeEvidenceText('Aggregate counts only.'),
  false,
  'safe text not raw',
);
assertEqual(
  module.isSafeEvidenceRef('private/oracle/stdout.txt'),
  true,
  'safe relative evidence ref',
);
assertEqual(
  module.isSafeEvidenceRef('artifacts/steps/01-local-bulk/stdout.txt'),
  true,
  'safe step evidence ref',
);
assertEqual(module.isSafeEvidenceRef('../private/raw-dump.json'), false, 'parent traversal ref');
assertEqual(module.isSafeEvidenceRef('/tmp/rawdump.json'), false, 'absolute raw dump ref');
assertEqual(module.isSafeEvidenceRef('manifest.json#secret'), false, 'fragment evidence ref');

assertDeepEqual(module.deriveEscalationReasons(validInput()), [], 'clean local has no escalation');
assertDeepEqual(
  module.deriveEscalationReasons(
    validInput({
      gates: {
        finalVerdict: 'fail',
        privateOracle: 'fail',
        blockingReviewDefects: ['unsafe artifact ref'],
      },
      cost: {
        frontierTokensTotal: 500,
        providerUsdTotal: 0.12,
        localWallSecondsTotal: 901,
      },
    }),
  ),
  [
    'public-gate-failure',
    'private-oracle-failure',
    'blocking-review-defects',
    'frontier-budget-used',
    'local-wall-time-high',
  ],
  'escalation reasons are stable',
);

assertEqual(
  module.selectRouteDecision(validInput()).decision,
  'local-screen',
  'clean local screen',
);
assertEqual(
  module.selectRouteDecision(
    validInput({ route: { arm: 'frontier-only', selectedModel: 'codex-default' } }),
  ).decision,
  'frontier-baseline',
  'frontier arm remains frontier baseline',
);
assertEqual(
  module.selectRouteDecision(
    validInput({
      gates: { finalVerdict: 'pass', privateOracle: 'fail', blockingReviewDefects: [] },
    }),
  ).decision,
  'frontier-baseline',
  'private oracle failure goes frontier',
);
assertEqual(
  module.selectRouteDecision(
    validInput({
      gates: { finalVerdict: 'fail', privateOracle: 'pass', blockingReviewDefects: [] },
    }),
  ).decision,
  'advisor-escalate',
  'public gate failure gets advisor escalation',
);

const record = check(module.buildRouteDecisionRecord, validInput(), true, 'safe record');
assertEqual(record.schemaVersion, 'portarium.route-decision-record.v1', 'record schema');
assertEqual(record.selectedRoute.decision, 'local-screen', 'record selected route');
assertEqual(record.selectedRoute.arm, 'local-only', 'record selected arm');
assertDeepEqual(record.escalationReasons, [], 'record no escalation');
if (Object.hasOwn(record, 'notes') || Object.hasOwn(record, 'metadata')) {
  fail('safe record: unexpected extra top-level fields were preserved');
}

const advisorRecord = check(
  module.buildRouteDecisionRecord,
  validInput({
    gates: { finalVerdict: 'fail', privateOracle: 'pass', blockingReviewDefects: [] },
  }),
  true,
  'advisor escalation record',
);
assertEqual(advisorRecord.selectedRoute.decision, 'advisor-escalate', 'advisor record route');

check(module.buildRouteDecisionRecord, null, false, 'null rejected without throwing');
check(module.buildRouteDecisionRecord, [], false, 'array rejected without throwing');
check(
  module.buildRouteDecisionRecord,
  validInput({ schemaVersion: 'harness.route-input.v0' }),
  false,
  'unsupported schema rejected',
);
check(
  module.buildRouteDecisionRecord,
  validInput({ metadata: { nested: [{ 'Oracle Command': 'node private/oracle.mjs' }] } }),
  false,
  'separator-insensitive oracle command key rejected',
);
check(
  module.buildRouteDecisionRecord,
  validInput({ metadata: { nested: [{ 'api-key': 'sk-not-real' }] } }),
  false,
  'separator-insensitive api key rejected',
);
check(
  module.buildRouteDecisionRecord,
  validInput({ summary: 'Reviewer copied hidden oracle body into a note.' }),
  false,
  'hidden oracle body text rejected',
);
check(
  module.buildRouteDecisionRecord,
  validInput({ summary: 'Aggregate only, but raw transcript appears in a footnote.' }),
  false,
  'raw transcript text rejected',
);
check(
  module.buildRouteDecisionRecord,
  validInput({ cost: { frontierTokensTotal: -1, providerUsdTotal: 0, localWallSecondsTotal: 0 } }),
  false,
  'negative cost rejected',
);
check(
  module.buildRouteDecisionRecord,
  validInput({
    artifactRefs: {
      manifest: '/tmp/rawdump.json',
      stepStdout: 'artifacts/steps/01-local-bulk/stdout.txt',
      oracleStdout: 'private/oracle/stdout.txt',
    },
  }),
  false,
  'absolute raw dump artifact rejected',
);

console.log('gslr7 private oracle passed');

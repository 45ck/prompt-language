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
      id: 'gslr8-route-record-compiler',
      runId: 'gslr8-route-record-compiler-live',
      runGroupId: 'gslr8-route-record-compiler',
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
      localWallSecondsTotal: 39,
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
  moduleUrl.search = `oracle=${Date.now()}-${Math.random()}`;
  return import(moduleUrl.href);
}

async function loadWorkspace(workspace) {
  const scaffoldPath = join(workspace, 'src', 'route-decision-scaffold.mjs');
  const hooksPath = join(workspace, 'src', 'route-predicate-hooks.mjs');
  if (!existsSync(scaffoldPath)) fail('missing src/route-decision-scaffold.mjs');
  if (!existsSync(hooksPath)) fail('missing src/route-predicate-hooks.mjs');

  const scaffoldSource = readFileSync(scaffoldPath, 'utf8');
  const hooksSource = readFileSync(hooksPath, 'utf8');

  if (!scaffoldSource.includes("from './route-predicate-hooks.mjs'")) {
    fail('scaffold must import the generated hook file');
  }
  for (const scaffoldOwned of [
    'UNSAFE_EVIDENCE_KEYS',
    'oraclecommand',
    'ESCALATION_REASON_ORDER',
    'selectedRoute',
    'frontier-baseline',
    'local-screen',
    'advisor-escalate',
  ]) {
    if (!scaffoldSource.includes(scaffoldOwned)) {
      fail(`scaffold does not own required invariant: ${scaffoldOwned}`);
    }
  }
  for (const modelForbidden of [
    'oraclecommand',
    'rawpayload',
    'selectedRoute',
    'frontier-baseline',
    'local-screen',
    'advisor-escalate',
    'public-gate-failure',
    'private-oracle-failure',
  ]) {
    if (hooksSource.includes(modelForbidden)) {
      fail(`hook file owns scaffold policy invariant: ${modelForbidden}`);
    }
  }
  for (const name of ['matchesAnyEvidenceTextPattern', 'isRelativeArtifactReference']) {
    if (
      !hooksSource.includes(`export function ${name}`) &&
      !hooksSource.includes(`export { ${name}`)
    ) {
      fail(`missing hook export: ${name}`);
    }
  }

  const scaffold = await importFresh(scaffoldPath);
  const hooks = await importFresh(hooksPath);
  for (const name of [
    'normalizeRouteKey',
    'isUnsafeEvidenceKey',
    'containsUnsafeEvidenceText',
    'isSafeEvidenceRef',
    'deriveEscalationReasons',
    'selectRouteDecision',
    'buildRouteDecisionRecord',
  ]) {
    if (typeof scaffold[name] !== 'function') fail(`missing scaffold export: ${name}`);
  }
  for (const name of ['matchesAnyEvidenceTextPattern', 'isRelativeArtifactReference']) {
    if (typeof hooks[name] !== 'function') fail(`missing hook function: ${name}`);
  }
  return { hooks, scaffold };
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
const { hooks, scaffold } = await loadWorkspace(workspace);

assertEqual(
  hooks.matchesAnyEvidenceTextPattern('BEGIN RAW PAYLOAD: student identifier 42', [
    /begin\s+raw\s+payload/i,
  ]),
  true,
  'hook matches supplied regex',
);
assertEqual(
  hooks.matchesAnyEvidenceTextPattern('aggregate only', [/begin\s+raw\s+payload/i]),
  false,
  'hook ignores safe text',
);
assertEqual(
  hooks.isRelativeArtifactReference('artifacts/steps/01-local-bulk/stdout.txt'),
  true,
  'hook accepts relative artifact',
);
assertEqual(
  hooks.isRelativeArtifactReference('../private/raw.json'),
  false,
  'hook rejects parent ref',
);
assertEqual(
  hooks.isRelativeArtifactReference('file:///tmp/raw.json'),
  false,
  'hook rejects scheme',
);
assertEqual(
  hooks.isRelativeArtifactReference('manifest.json#secret'),
  false,
  'hook rejects fragment',
);

assertEqual(scaffold.normalizeRouteKey('Oracle Command'), 'oraclecommand', 'normalizes spaces');
assertEqual(
  scaffold.normalizeRouteKey('oracle_command'),
  'oraclecommand',
  'normalizes underscores',
);
assertEqual(scaffold.isUnsafeEvidenceKey('oracle command'), true, 'forbidden oracle command key');
assertEqual(scaffold.isUnsafeEvidenceKey('api-key'), true, 'forbidden api key');
assertEqual(scaffold.isUnsafeEvidenceKey('safeSummary'), false, 'allows safe summary key');
assertEqual(
  scaffold.containsUnsafeEvidenceText('BEGIN RAW PAYLOAD: student identifier 42'),
  true,
  'raw text match',
);
assertEqual(scaffold.containsUnsafeEvidenceText('Aggregate counts only.'), false, 'safe text');
assertEqual(scaffold.isSafeEvidenceRef('private/oracle/stdout.txt'), true, 'safe private ref');
assertEqual(scaffold.isSafeEvidenceRef('../private/raw-dump.json'), false, 'parent traversal ref');
assertEqual(scaffold.isSafeEvidenceRef('/tmp/rawdump.json'), false, 'absolute raw dump ref');

assertDeepEqual(scaffold.deriveEscalationReasons(validInput()), [], 'clean local no escalation');
assertDeepEqual(
  scaffold.deriveEscalationReasons(
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
  'stable escalation reasons',
);

assertEqual(scaffold.selectRouteDecision(validInput()).decision, 'local-screen', 'clean local');
assertEqual(
  scaffold.selectRouteDecision(
    validInput({ route: { arm: 'frontier-only', selectedModel: 'codex-default' } }),
  ).decision,
  'frontier-baseline',
  'frontier arm',
);
assertEqual(
  scaffold.selectRouteDecision(
    validInput({
      gates: { finalVerdict: 'pass', privateOracle: 'fail', blockingReviewDefects: [] },
    }),
  ).decision,
  'frontier-baseline',
  'private oracle failure',
);
assertEqual(
  scaffold.selectRouteDecision(
    validInput({
      gates: { finalVerdict: 'fail', privateOracle: 'pass', blockingReviewDefects: [] },
    }),
  ).decision,
  'advisor-escalate',
  'public gate failure',
);

const record = check(scaffold.buildRouteDecisionRecord, validInput(), true, 'safe record');
assertEqual(record.schemaVersion, 'portarium.route-decision-record.v1', 'record schema');
assertEqual(record.workItem.id, 'gslr8-route-record-compiler', 'work item id');
assertEqual(record.selectedRoute.decision, 'local-screen', 'record selected route');
assertEqual(record.selectedRoute.arm, 'local-only', 'record selected arm');
assertEqual(record.selectedRoute.selectedProvider, 'ollama', 'record selected provider');
assertDeepEqual(record.escalationReasons, [], 'record no escalation');
if (Object.hasOwn(record, 'notes') || Object.hasOwn(record, 'metadata')) {
  fail('safe record: unexpected extra top-level fields were preserved');
}

check(scaffold.buildRouteDecisionRecord, null, false, 'null rejected without throwing');
check(scaffold.buildRouteDecisionRecord, [], false, 'array rejected without throwing');
check(
  scaffold.buildRouteDecisionRecord,
  validInput({ schemaVersion: 'harness.route-input.v0' }),
  false,
  'unsupported schema rejected',
);
check(
  scaffold.buildRouteDecisionRecord,
  validInput({ metadata: { nested: [{ 'Oracle Command': 'node private/oracle.mjs' }] } }),
  false,
  'separator-insensitive oracle command key rejected',
);
check(
  scaffold.buildRouteDecisionRecord,
  validInput({ summary: 'Reviewer copied hidden oracle body into a note.' }),
  false,
  'hidden oracle body text rejected',
);
check(
  scaffold.buildRouteDecisionRecord,
  validInput({ summary: 'Aggregate only, but raw transcript appears in a footnote.' }),
  false,
  'raw transcript text rejected',
);
check(
  scaffold.buildRouteDecisionRecord,
  validInput({ cost: { frontierTokensTotal: -1, providerUsdTotal: 0, localWallSecondsTotal: 0 } }),
  false,
  'negative cost rejected',
);
check(
  scaffold.buildRouteDecisionRecord,
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

console.log('gslr8 private oracle passed');

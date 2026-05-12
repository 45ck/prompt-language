#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

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

function validEnvelope(overrides = {}) {
  return {
    version: 'gslr.action-policy.v1',
    workItem: {
      id: 'bead-1231',
      repo: 'Portarium',
      intent: 'Record the GSLR-2 schema evidence boundary before product work.',
    },
    route: {
      providerClass: 'hybrid',
      reason: 'Bounded local implementation plus frontier review if evidence requires it.',
    },
    gates: [
      { id: 'public-gate', kind: 'public', required: true },
      { id: 'private-oracle', kind: 'private', required: true },
      { id: 'frontier-review', kind: 'review', required: true },
    ],
    budget: {
      frontierCallLimit: 2,
      usdLimit: 0.5,
      requiresTokenTelemetry: true,
    },
    evidence: {
      finalVerdictRequired: true,
      blockingReviewDefectsFail: true,
      manifestRef: 'runs/gslr2/hybrid-routing-manifest.json',
    },
    ...overrides,
  };
}

async function loadValidator(workspace) {
  const modulePath = join(workspace, 'src', 'action-policy-schema.mjs');
  if (!existsSync(modulePath)) fail('missing src/action-policy-schema.mjs');

  const moduleUrl = pathToFileURL(modulePath);
  moduleUrl.search = `?oracle=${Date.now()}-${Math.random()}`;
  const module = await import(moduleUrl.href);
  if (typeof module.validateActionPolicyEnvelope !== 'function') {
    fail('missing validateActionPolicyEnvelope export');
  }
  return module.validateActionPolicyEnvelope;
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
}

function check(validate, envelope, expectedOk, label) {
  const input = clone(envelope);
  const before = JSON.stringify(input);
  const result = validate(input);

  assertResultShape(result, label);
  if (JSON.stringify(input) !== before) fail(`${label}: validator mutated input`);
  if (result.ok !== expectedOk) fail(`${label}: expected ok=${expectedOk}`);
  if (expectedOk && result.errors.length !== 0) fail(`${label}: pass result returned errors`);
  if (!expectedOk && result.errors.length === 0) fail(`${label}: fail result returned no errors`);
}

const { workspace } = parseArgs(process.argv.slice(2));
const validate = await loadValidator(workspace);

check(validate, validEnvelope(), true, 'valid hybrid envelope');
check(
  validate,
  validEnvelope({
    workItem: {
      id: 'prompt-language-gslr6',
      repo: 'prompt-language',
      intent: 'Run a deterministic fake-live proof before a model run.',
    },
    route: { providerClass: 'deterministic', reason: 'Harness plumbing proof.' },
  }),
  true,
  'valid deterministic prompt-language envelope',
);
check(
  validate,
  validEnvelope({ metadata: { nested: [{ sourcePayload: { hidden: true } }] } }),
  false,
  'nested sourcePayload rejected',
);
check(
  validate,
  validEnvelope({ context: { actions: [{ token: 'do-not-allow' }] } }),
  false,
  'nested token rejected',
);
check(
  validate,
  validEnvelope({ context: { studentPayload: { id: 'student-1' } } }),
  false,
  'student payload rejected',
);
check(
  validate,
  validEnvelope({ budget: { frontierCallLimit: 1, usdLimit: 0.1, requiresTokenTelemetry: false } }),
  false,
  'token telemetry is required',
);
check(
  validate,
  validEnvelope({ gates: [{ id: 'private-oracle', kind: 'private', required: false }] }),
  false,
  'every gate must be required',
);
check(
  validate,
  validEnvelope({ workItem: { id: 'bead-1231', repo: '*', intent: 'wildcard repo' } }),
  false,
  'wildcard repo rejected',
);
check(
  validate,
  validEnvelope({ route: { providerClass: 'advisor', reason: 'not a provider class' } }),
  false,
  'unknown provider rejected',
);
check(
  validate,
  validEnvelope({ evidence: { finalVerdictRequired: false } }),
  false,
  'final verdict is required',
);

console.log('gslr2 private oracle passed');

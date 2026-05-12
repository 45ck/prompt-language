import assert from 'node:assert/strict';

import { validateActionPolicyEnvelope } from '../src/action-policy-schema.mjs';

function validEnvelope(overrides = {}) {
  return {
    version: 'gslr.action-policy.v1',
    workItem: {
      id: 'prompt-language-gslr6',
      repo: 'prompt-language',
      intent: 'Implement the GSLR-2 policy validator under public and private gates.',
    },
    route: {
      providerClass: 'hybrid',
      reason: 'Use local implementation with frontier review only where evidence requires it.',
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

function expectPass(envelope, label) {
  const result = validateActionPolicyEnvelope(envelope);

  assert.equal(result.ok, true, label);
  assert.deepEqual(result.errors, [], label);
}

function expectFail(envelope, label) {
  const result = validateActionPolicyEnvelope(envelope);

  assert.equal(result.ok, false, label);
  assert.ok(Array.isArray(result.errors), label);
  assert.ok(result.errors.length > 0, label);
  assert.ok(
    result.errors.every((error) => typeof error === 'string' && error.length > 0),
    label,
  );
}

expectPass(validEnvelope(), 'valid hybrid envelope passes');
expectPass(
  validEnvelope({
    workItem: {
      id: 'bead-1231',
      repo: 'Portarium',
      intent: 'Render a static evidence card only after positive manifest evidence.',
    },
    route: { providerClass: 'local', reason: 'Bounded implementation route.' },
  }),
  'valid Portarium local envelope passes',
);

expectFail(validEnvelope({ version: 'gslr.action-policy.v2' }), 'wrong version fails');
expectFail(null, 'null envelope fails with a result shape');
expectFail([], 'array envelope fails with a result shape');
expectFail(
  validEnvelope({ workItem: { id: 'ticket-7', repo: 'prompt-language', intent: 'bad id' } }),
  'unsupported work item id fails',
);
expectFail(
  validEnvelope({ route: { providerClass: 'solo', reason: 'unknown provider' } }),
  'unknown provider fails',
);
expectFail(validEnvelope({ gates: [] }), 'empty gates fail');
expectFail(
  validEnvelope({ gates: [{ id: 'private-oracle', kind: 'private', required: false }] }),
  'optional gate fails',
);
expectFail(
  validEnvelope({ budget: { frontierCallLimit: 1, usdLimit: 0.1, requiresTokenTelemetry: false } }),
  'missing token telemetry requirement fails',
);
expectFail(
  validEnvelope({
    evidence: {
      finalVerdictRequired: true,
      blockingReviewDefectsFail: true,
      manifestRef: 'runs/gslr2/summary.json',
    },
  }),
  'missing manifest ref fails',
);
expectFail(
  validEnvelope({ metadata: { sourcePayload: { studentId: 'hidden' } } }),
  'raw payload leakage fails',
);

console.log('gslr2 public gate passed');

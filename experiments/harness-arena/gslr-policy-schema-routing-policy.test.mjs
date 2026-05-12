import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  normalizeGslrPolicySchemaTask,
  resolveGslrPolicySchemaRoute,
} from './gslr-policy-schema-routing-policy.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const POLICY_PATH = join(import.meta.dirname, 'gslr-policy-schema-routing-policy.v1.json');

function readPolicy() {
  return JSON.parse(readFileSync(POLICY_PATH, 'utf8'));
}

function routeByTask(policy, task) {
  const route = policy.routes.find((entry) => entry.task === task);
  assert.ok(route, `missing route for ${task}`);
  return route;
}

test('GSLR policy-schema policy exposes routes after live evidence', () => {
  const policy = readPolicy();
  assert.equal(policy.policyVersion, 'gslr-policy-schema-routing-v2');
  assert.equal(policy.model.name, 'qwen3-coder:30b');

  const route = routeByTask(policy, 'gslr2-policy-schema');
  assert.equal(route.decision, 'local-screen');
  assert.equal(route.owner, 'local');
  assert.equal(route.cleanPasses, 1);
  assert.equal(route.totalRuns, 1);
  assert.equal(route.measuredArms.localOnly.frontierTokens, 0);
  assert.equal(route.measuredArms.localOnly.finalVerdict, 'pass');
  assert.equal(route.measuredArms.frontierOnly.frontierTokens, 45713);
  assert.equal(route.measuredArms.advisorOnly.frontierTokens, 15301);
  assert.equal(route.measuredArms.hybridRouter.frontierTokens, 91279);
  assert.match(route.notes, /negative evidence for mandatory hybrid-router review/);

  const transformRoute = routeByTask(policy, 'gslr3-policy-manifest-transform');
  assert.equal(transformRoute.decision, 'frontier-baseline');
  assert.equal(transformRoute.owner, 'frontier');
  assert.equal(transformRoute.measuredArms.localOnly.finalVerdict, 'fail');
  assert.equal(transformRoute.measuredArms.advisorOnly.finalVerdict, 'fail');
  assert.equal(transformRoute.measuredArms.frontierOnly.finalVerdict, 'pass');
  assert.equal(transformRoute.measuredArms.frontierOnly.frontierTokens, 33913);
  assert.match(transformRoute.notes, /local-screen hypothesis failed/);

  const validatorRoute = routeByTask(policy, 'gslr4-two-file-validator');
  assert.equal(validatorRoute.decision, 'frontier-baseline');
  assert.equal(validatorRoute.measuredArms.frontierOnly.finalVerdict, 'pass');
  assert.equal(validatorRoute.measuredArms.localOnly.finalVerdict, 'fail');

  const payloadRoute = routeByTask(policy, 'gslr5-raw-payload-adversarial');
  assert.equal(payloadRoute.decision, 'frontier-baseline');
  assert.equal(payloadRoute.owner, 'frontier');
  assert.equal(payloadRoute.cleanPasses, 1);
  assert.equal(payloadRoute.measuredArms.frontierOnly.finalVerdict, 'pass');
  assert.equal(payloadRoute.measuredArms.frontierOnly.frontierTokens, 53668);
  assert.equal(payloadRoute.measuredArms.localOnly.finalVerdict, 'fail');
  assert.match(payloadRoute.notes, /Local-only failed/);
});

test('GSLR policy-schema policy references checked-in evidence and harness files', () => {
  const policy = readPolicy();

  assert.ok(existsSync(join(ROOT, policy.evidence.liveResultDoc)), 'live result doc missing');
  for (const doc of policy.evidence.additionalLiveResultDocs ?? []) {
    assert.ok(existsSync(join(ROOT, doc)), `${doc} missing`);
  }
  assert.ok(existsSync(join(ROOT, policy.evidence.runbook)), 'runbook missing');
  assert.ok(existsSync(join(ROOT, policy.evidence.researchDecisionDoc)), 'research doc missing');

  for (const route of policy.routes) {
    assert.ok(existsSync(join(ROOT, route.fixture)), `${route.fixture} missing`);
    assert.ok(existsSync(join(ROOT, route.oracle)), `${route.oracle} missing`);
    assert.ok(existsSync(join(ROOT, route.liveLocalLane)), `${route.liveLocalLane} missing`);
    assert.ok(existsSync(join(ROOT, route.liveFrontierLane)), `${route.liveFrontierLane} missing`);
  }
});

test('GSLR policy-schema resolver maps aliases to route decisions', () => {
  assert.equal(normalizeGslrPolicySchemaTask('gslr2'), 'gslr2-policy-schema');
  assert.equal(normalizeGslrPolicySchemaTask('schema-validator'), 'gslr2-policy-schema');
  assert.equal(normalizeGslrPolicySchemaTask('gslr3'), 'gslr3-policy-manifest-transform');
  assert.equal(
    normalizeGslrPolicySchemaTask('evidence-card-transform'),
    'gslr3-policy-manifest-transform',
  );
  assert.equal(
    normalizeGslrPolicySchemaTask('evidence-card-validator'),
    'gslr4-two-file-validator',
  );
  assert.equal(normalizeGslrPolicySchemaTask('payload-sanitizer'), 'gslr5-raw-payload-adversarial');

  const resolved = resolveGslrPolicySchemaRoute('policy-schema');
  assert.equal(resolved.shouldRunLocalScreen, true);
  assert.equal(resolved.shouldRunLocal, false);
  assert.equal(resolved.shouldRunFrontier, false);
  assert.equal(resolved.shouldRunHybrid, false);
  assert.equal(resolved.route.selectedModel.name, 'qwen3-coder:30b');
  assert.equal(resolved.nextFixtureFamily.length, 3);
  assert.ok(resolved.escalationTriggers.includes('private-oracle-failure'));

  const transform = resolveGslrPolicySchemaRoute('manifest-transform');
  assert.equal(transform.shouldRunLocalScreen, false);
  assert.equal(transform.shouldRunFrontier, true);
  assert.equal(transform.shouldRunHybrid, false);
  assert.equal(transform.route.selectedModel.provider, 'openai');
  assert.equal(transform.route.decision, 'frontier-baseline');

  const payload = resolveGslrPolicySchemaRoute('gslr5');
  assert.equal(payload.shouldRunFrontier, true);
  assert.equal(payload.route.selectedModel.provider, 'openai');
  assert.equal(payload.route.cleanPasses, 1);

  assert.throws(
    () => resolveGslrPolicySchemaRoute('unknown-task'),
    /unknown GSLR policy-schema task/,
  );
});

test('GSLR policy-schema resolver CLI emits JSON decisions', () => {
  const result = spawnSync(
    process.execPath,
    [join(import.meta.dirname, 'gslr-policy-schema-routing-policy.mjs'), 'gslr2', '--json'],
    { encoding: 'utf8', windowsHide: true },
  );

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.policyVersion, 'gslr-policy-schema-routing-v2');
  assert.equal(parsed.shouldRunLocalScreen, true);
  assert.equal(parsed.route.task, 'gslr2-policy-schema');
  assert.equal(parsed.route.decision, 'local-screen');
});

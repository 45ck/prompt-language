import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { normalizeH14Subrole, resolveH14LocalRoute } from './h14-local-routing-policy.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const POLICY_PATH = join(import.meta.dirname, 'h14-local-routing-policy.v1.json');

function readPolicy() {
  return JSON.parse(readFileSync(POLICY_PATH, 'utf8'));
}

function routeBySubrole(policy, subrole) {
  const route = policy.routes.find((entry) => entry.subrole === subrole);
  assert.ok(route, `missing route for ${subrole}`);
  return route;
}

test('H14 local routing policy promotes only model-backed stable subroles', () => {
  const policy = readPolicy();
  assert.equal(policy.policyVersion, 'h14-local-subrole-routing-v1');

  for (const route of policy.routes) {
    if (route.decision === 'local-promoted') {
      assert.equal(route.owner, 'local');
      assert.ok(route.selectedModel, `${route.subrole} is local-promoted without a model`);
      assert.equal(route.selectedModel.provider, 'ollama');
      assert.ok(
        route.cleanPasses >= policy.evidence.minimumCleanPassesForPromotion,
        `${route.subrole} is promoted without enough clean passes`,
      );
      assert.equal(route.cleanPasses, route.totalRuns);
    } else {
      assert.equal(route.selectedModel, null);
      assert.notEqual(
        route.owner,
        'local',
        `${route.subrole} is non-promoted but still local-owned`,
      );
    }
  }

  assert.equal(routeBySubrole(policy, 'h14-implementation-from-tests').decision, 'local-promoted');
  assert.equal(
    routeBySubrole(policy, 'h14-api-preserving-implementation').decision,
    'local-promoted',
  );
  assert.equal(routeBySubrole(policy, 'h14-test-authoring').decision, 'local-promoted');
  assert.equal(routeBySubrole(policy, 'h14-full-tdd').decision, 'frontier-owned-or-hybrid-repair');
});

test('H14 local routing policy records promoted fallback models without selecting slow first', () => {
  const policy = readPolicy();
  const implementation = routeBySubrole(policy, 'h14-implementation-from-tests');
  const apiPreservation = routeBySubrole(policy, 'h14-api-preserving-implementation');
  const testAuthoring = routeBySubrole(policy, 'h14-test-authoring');

  assert.equal(implementation.selectedModel.name, 'qwen3-coder:30b');
  assert.equal(apiPreservation.selectedModel.name, 'qwen3-coder:30b');
  assert.equal(testAuthoring.selectedModel.name, 'qwen3-coder:30b');
  assert.deepEqual(
    implementation.fallbackModels.map((model) => model.name),
    ['devstral-small-2:24b', 'qwen3-opencode:30b'],
  );
  assert.deepEqual(
    apiPreservation.fallbackModels.map((model) => model.name),
    ['devstral-small-2:24b', 'qwen3-opencode:30b'],
  );
});

test('H14 local routing policy references checked-in evidence and harness files', () => {
  const policy = readPolicy();
  const evidenceDoc = join(ROOT, policy.evidence.summaryDoc);
  assert.ok(existsSync(evidenceDoc), 'summary evidence doc missing');
  assert.ok(existsSync(join(ROOT, policy.evidence.candidatePlanDoc)), 'candidate plan doc missing');

  const evidence = readFileSync(evidenceDoc, 'utf8');
  for (const route of policy.routes) {
    assert.ok(existsSync(join(ROOT, route.fixture)), `${route.fixture} missing`);
    assert.ok(existsSync(join(ROOT, route.flow)), `${route.flow} missing`);
    assert.ok(existsSync(join(ROOT, route.oracle)), `${route.oracle} missing`);
  }

  assert.match(evidence, /Qwen3 OpenCode Decision/);
  assert.match(evidence, /Devstral Decision/);
  assert.match(evidence, /Refresh Decision/);
  assert.match(evidence, /Clarified Test-Authoring Decision/);
});

test('H14 local route resolver maps aliases to selected local and escalation decisions', () => {
  assert.equal(normalizeH14Subrole('api-preservation'), 'h14-api-preserving-implementation');
  assert.equal(normalizeH14Subrole('implementation-from-tests'), 'h14-implementation-from-tests');

  const implementation = resolveH14LocalRoute('implementation-from-tests');
  assert.equal(implementation.shouldRunLocal, true);
  assert.equal(implementation.model.name, 'qwen3-coder:30b');
  assert.equal(implementation.route.owner, 'local');
  assert.match(implementation.route.flow, /h14-impl-from-tests-worker\.flow$/);

  const testAuthoring = resolveH14LocalRoute('test-authoring');
  assert.equal(testAuthoring.shouldRunLocal, true);
  assert.equal(testAuthoring.model.name, 'qwen3-coder:30b');
  assert.equal(testAuthoring.route.owner, 'local');
  assert.match(testAuthoring.route.flow, /h14-test-authoring-worker\.flow$/);

  assert.throws(() => resolveH14LocalRoute('unknown-subrole'), /unknown H14 local subrole/);
});

test('H14 local route resolver CLI emits JSON decisions', () => {
  const result = spawnSync(
    process.execPath,
    [join(import.meta.dirname, 'h14-local-routing-policy.mjs'), 'api-preservation', '--json'],
    { encoding: 'utf8', windowsHide: true },
  );

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.shouldRunLocal, true);
  assert.equal(parsed.model.name, 'qwen3-coder:30b');
  assert.equal(parsed.route.subrole, 'h14-api-preserving-implementation');
});

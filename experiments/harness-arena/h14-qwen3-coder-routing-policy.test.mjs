import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  normalizeH14QwenCoderSubrole,
  resolveH14QwenCoderRoute,
} from './h14-qwen3-coder-routing-policy.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const POLICY_PATH = join(import.meta.dirname, 'h14-qwen3-coder-routing-policy.v1.json');

function readPolicy() {
  return JSON.parse(readFileSync(POLICY_PATH, 'utf8'));
}

function routeBySubrole(policy, subrole) {
  const route = policy.routes.find((entry) => entry.subrole === subrole);
  assert.ok(route, `missing route for ${subrole}`);
  return route;
}

test('H14 qwen3-coder routing policy promotes only stable local subroles', () => {
  const policy = readPolicy();
  assert.equal(policy.policyVersion, 'h14-qwen3-coder-subrole-routing-v1');
  assert.equal(policy.model.name, 'qwen3-coder:30b');

  for (const route of policy.routes) {
    if (route.decision === 'local-promoted') {
      assert.equal(route.owner, 'local');
      assert.ok(
        route.cleanPasses >= policy.evidence.minimumCleanPassesForPromotion,
        `${route.subrole} is promoted without enough clean passes`,
      );
      assert.equal(route.cleanPasses, route.totalRuns);
    } else {
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
  assert.equal(routeBySubrole(policy, 'h14-test-authoring').decision, 'frontier-or-deterministic');
  assert.equal(routeBySubrole(policy, 'h14-full-tdd').decision, 'frontier-owned-or-hybrid-repair');
});

test('H14 qwen3-coder routing policy references checked-in evidence and harness files', () => {
  const policy = readPolicy();
  const evidenceDoc = join(ROOT, policy.evidence.summaryDoc);
  assert.ok(existsSync(evidenceDoc), 'summary evidence doc missing');
  assert.ok(existsSync(join(ROOT, policy.evidence.selectionDoc)), 'selection doc missing');

  const evidence = readFileSync(evidenceDoc, 'utf8');
  for (const route of policy.routes) {
    assert.ok(existsSync(join(ROOT, route.fixture)), `${route.fixture} missing`);
    assert.ok(existsSync(join(ROOT, route.flow)), `${route.flow} missing`);
    assert.ok(existsSync(join(ROOT, route.oracle)), `${route.oracle} missing`);
    assert.match(evidence, new RegExp(route.subrole.split('-').at(1) ?? route.subrole));
  }

  assert.match(evidence, /S2 Decision/);
  assert.match(evidence, /S3 Decision/);
  assert.match(evidence, /S4 Decision/);
});

test('H14 qwen3-coder route resolver maps aliases to local and escalation decisions', () => {
  assert.equal(
    normalizeH14QwenCoderSubrole('api-preservation'),
    'h14-api-preserving-implementation',
  );
  assert.equal(
    normalizeH14QwenCoderSubrole('implementation-from-tests'),
    'h14-implementation-from-tests',
  );

  const implementation = resolveH14QwenCoderRoute('implementation-from-tests');
  assert.equal(implementation.shouldRunLocal, true);
  assert.equal(implementation.route.owner, 'local');
  assert.match(implementation.route.flow, /h14-impl-from-tests-worker\.flow$/);

  const testAuthoring = resolveH14QwenCoderRoute('test-authoring');
  assert.equal(testAuthoring.shouldRunLocal, false);
  assert.equal(testAuthoring.route.owner, 'frontier-or-deterministic-template');

  const fullTdd = resolveH14QwenCoderRoute('full-tdd');
  assert.equal(fullTdd.shouldRunLocal, false);
  assert.equal(fullTdd.route.owner, 'frontier');

  assert.throws(
    () => resolveH14QwenCoderRoute('unknown-subrole'),
    /unknown H14 qwen3-coder subrole/,
  );
});

test('H14 qwen3-coder route resolver CLI emits JSON decisions', () => {
  const result = spawnSync(
    process.execPath,
    [join(import.meta.dirname, 'h14-qwen3-coder-routing-policy.mjs'), 'api-preservation', '--json'],
    { encoding: 'utf8', windowsHide: true },
  );

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.shouldRunLocal, true);
  assert.equal(parsed.route.subrole, 'h14-api-preserving-implementation');
});

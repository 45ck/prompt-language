import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  normalizeH15QwenCoderTask,
  resolveH15QwenCoderRoute,
} from './h15-qwen3-coder-routing-policy.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const POLICY_PATH = join(import.meta.dirname, 'h15-qwen3-coder-routing-policy.v1.json');

function readPolicy() {
  return JSON.parse(readFileSync(POLICY_PATH, 'utf8'));
}

function routeByTask(policy, task) {
  const route = policy.routes.find((entry) => entry.task === task);
  assert.ok(route, `missing route for ${task}`);
  return route;
}

test('H15 qwen3-coder policy routes endpoint work to frontier baseline', () => {
  const policy = readPolicy();
  assert.equal(policy.policyVersion, 'h15-qwen3-coder-endpoint-routing-v2');

  const route = routeByTask(policy, 'h15-api-endpoint');
  assert.equal(route.decision, 'frontier-baseline');
  assert.equal(route.owner, 'frontier');
  assert.equal(route.selectedModel.name, 'codex-default');
  assert.equal(route.localDraftModel.name, 'qwen3-coder:30b');
  assert.equal(route.cleanPasses, 1);
  assert.ok(
    route.cleanPasses < policy.evidence.minimumCleanPassesForPromotion,
    'H15 route should not meet local promotion threshold',
  );
  assert.match(route.localStopPolicy, /validation\/test micro-flow/);
});

test('H15 qwen3-coder policy exposes validation-only local screen', () => {
  const policy = readPolicy();
  const route = routeByTask(policy, 'h15-validation-only');

  assert.equal(route.decision, 'local-screen');
  assert.equal(route.owner, 'local');
  assert.equal(route.selectedModel.name, 'qwen3-coder:30b');
  assert.equal(route.localDraftModel.name, 'qwen3-coder:30b');
  assert.equal(route.cleanPasses, 1);
  assert.equal(route.totalRuns, 1);
  assert.match(route.flow, /h15-validation-only-worker\.flow$/);
  assert.match(route.oracle, /h15-validation-only-oracle\.mjs$/);
  assert.match(route.notes, /diagnostic micro-flow/);
});

test('H15 qwen3-coder policy exposes PATCH test-authoring local screen', () => {
  const policy = readPolicy();
  const route = routeByTask(policy, 'h15-patch-test-authoring');

  assert.equal(route.decision, 'local-screen');
  assert.equal(route.owner, 'local');
  assert.equal(route.selectedModel.name, 'qwen3-coder:30b');
  assert.equal(route.localDraftModel.name, 'qwen3-coder:30b');
  assert.equal(route.cleanPasses, 1);
  assert.equal(route.totalRuns, 5);
  assert.match(route.flow, /h15-patch-test-authoring-worker\.flow$/);
  assert.match(route.oracle, /h15-patch-test-authoring-oracle\.mjs$/);
  assert.match(route.notes, /tests-only H15 support/);
  assert.match(route.notes, /action-round exhaustion/);
  assert.match(route.notes, /wrong response API/);
  assert.match(route.notes, /qwen-coder-004 passed/);
  assert.match(route.notes, /live object reference/);
  assert.match(route.notes, /shared fixture id 1/);
});

test('H15 qwen3-coder policy references checked-in evidence and harness files', () => {
  const policy = readPolicy();
  const evidenceDoc = join(ROOT, policy.evidence.summaryDoc);

  assert.ok(existsSync(evidenceDoc), 'summary evidence doc missing');
  assert.ok(existsSync(join(ROOT, policy.evidence.selectionDoc)), 'selection doc missing');
  for (const policyRoute of policy.routes) {
    assert.ok(existsSync(join(ROOT, policyRoute.fixture)), `${policyRoute.fixture} missing`);
    assert.ok(existsSync(join(ROOT, policyRoute.flow)), `${policyRoute.flow} missing`);
    assert.ok(existsSync(join(ROOT, policyRoute.oracle)), `${policyRoute.oracle} missing`);
  }

  const evidence = readFileSync(evidenceDoc, 'utf8');
  assert.match(evidence, /frontier-only baseline/);
  assert.match(evidence, /use frontier-only as the current baseline route/);
  assert.match(evidence, /HA-HR1-H15-validation-only-qwen-coder-002/);
  assert.match(evidence, /qwen3-coder:30b/);
});

test('H15 qwen3-coder resolver maps aliases to frontier baseline decisions', () => {
  assert.equal(normalizeH15QwenCoderTask('api-endpoint'), 'h15-api-endpoint');
  assert.equal(normalizeH15QwenCoderTask('patch-contact'), 'h15-api-endpoint');
  assert.equal(normalizeH15QwenCoderTask('validation-only'), 'h15-validation-only');
  assert.equal(normalizeH15QwenCoderTask('test-authoring'), 'h15-patch-test-authoring');

  const endpoint = resolveH15QwenCoderRoute('patch-contact');
  assert.equal(endpoint.shouldRunLocal, false);
  assert.equal(endpoint.shouldRunHybrid, false);
  assert.equal(endpoint.shouldRunFrontier, true);
  assert.equal(endpoint.shouldRunLocalScreen, false);
  assert.equal(endpoint.localDraftModel.name, 'qwen3-coder:30b');
  assert.equal(endpoint.route.owner, 'frontier');
  assert.match(endpoint.route.flow, /h15-api-endpoint-worker\.flow$/);
  assert.match(endpoint.route.oracle, /h15-api-endpoint-oracle\.mjs$/);
  assert.ok(endpoint.escalationTriggers.includes('validation-semantic-miss'));

  assert.throws(() => resolveH15QwenCoderRoute('unknown-task'), /unknown H15 qwen3-coder task/);
});

test('H15 qwen3-coder resolver maps validation aliases to local screen decisions', () => {
  const validation = resolveH15QwenCoderRoute('validation-only');

  assert.equal(validation.shouldRunLocal, false);
  assert.equal(validation.shouldRunHybrid, false);
  assert.equal(validation.shouldRunFrontier, false);
  assert.equal(validation.shouldRunLocalScreen, true);
  assert.equal(validation.localDraftModel.name, 'qwen3-coder:30b');
  assert.equal(validation.route.owner, 'local');
  assert.equal(validation.route.task, 'h15-validation-only');
  assert.match(validation.route.flow, /h15-validation-only-worker\.flow$/);
  assert.match(validation.route.oracle, /h15-validation-only-oracle\.mjs$/);
});

test('H15 qwen3-coder resolver maps PATCH test-authoring aliases to local screen decisions', () => {
  const testsOnly = resolveH15QwenCoderRoute('patch-tests');

  assert.equal(testsOnly.shouldRunLocal, false);
  assert.equal(testsOnly.shouldRunHybrid, false);
  assert.equal(testsOnly.shouldRunFrontier, false);
  assert.equal(testsOnly.shouldRunLocalScreen, true);
  assert.equal(testsOnly.localDraftModel.name, 'qwen3-coder:30b');
  assert.equal(testsOnly.route.owner, 'local');
  assert.equal(testsOnly.route.task, 'h15-patch-test-authoring');
  assert.match(testsOnly.route.flow, /h15-patch-test-authoring-worker\.flow$/);
  assert.match(testsOnly.route.oracle, /h15-patch-test-authoring-oracle\.mjs$/);
});

test('H15 qwen3-coder resolver CLI emits JSON decisions', () => {
  const result = spawnSync(
    process.execPath,
    [join(import.meta.dirname, 'h15-qwen3-coder-routing-policy.mjs'), 'api-endpoint', '--json'],
    { encoding: 'utf8', windowsHide: true },
  );

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.shouldRunLocal, false);
  assert.equal(parsed.shouldRunHybrid, false);
  assert.equal(parsed.shouldRunFrontier, true);
  assert.equal(parsed.localDraftModel.name, 'qwen3-coder:30b');
  assert.equal(parsed.route.task, 'h15-api-endpoint');
  assert.equal(parsed.route.decision, 'frontier-baseline');
});

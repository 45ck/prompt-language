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

test('H15 qwen3-coder policy blocks local-only promotion for endpoint work', () => {
  const policy = readPolicy();
  assert.equal(policy.policyVersion, 'h15-qwen3-coder-endpoint-routing-v1');

  const route = routeByTask(policy, 'h15-api-endpoint');
  assert.equal(route.decision, 'hybrid-required');
  assert.equal(route.owner, 'hybrid');
  assert.equal(route.selectedModel, null);
  assert.equal(route.localDraftModel.name, 'qwen3-coder:30b');
  assert.equal(route.cleanPasses, 0);
  assert.ok(
    route.cleanPasses < policy.evidence.minimumCleanPassesForPromotion,
    'H15 route should not meet local promotion threshold',
  );
  assert.match(route.localStopPolicy, /first public-gate failure/);
});

test('H15 qwen3-coder policy references checked-in evidence and harness files', () => {
  const policy = readPolicy();
  const route = routeByTask(policy, 'h15-api-endpoint');
  const evidenceDoc = join(ROOT, policy.evidence.summaryDoc);

  assert.ok(existsSync(evidenceDoc), 'summary evidence doc missing');
  assert.ok(existsSync(join(ROOT, policy.evidence.selectionDoc)), 'selection doc missing');
  assert.ok(existsSync(join(ROOT, route.fixture)), `${route.fixture} missing`);
  assert.ok(existsSync(join(ROOT, route.flow)), `${route.flow} missing`);
  assert.ok(existsSync(join(ROOT, route.oracle)), `${route.oracle} missing`);

  const evidence = readFileSync(evidenceDoc, 'utf8');
  assert.match(evidence, /H15 is not promoted for local-only ownership/);
  assert.match(evidence, /hybrid route/);
  assert.match(evidence, /qwen3-coder:30b/);
});

test('H15 qwen3-coder resolver maps aliases to hybrid route decisions', () => {
  assert.equal(normalizeH15QwenCoderTask('api-endpoint'), 'h15-api-endpoint');
  assert.equal(normalizeH15QwenCoderTask('patch-contact'), 'h15-api-endpoint');

  const endpoint = resolveH15QwenCoderRoute('patch-contact');
  assert.equal(endpoint.shouldRunLocal, false);
  assert.equal(endpoint.shouldRunHybrid, true);
  assert.equal(endpoint.localDraftModel.name, 'qwen3-coder:30b');
  assert.equal(endpoint.route.owner, 'hybrid');
  assert.match(endpoint.route.flow, /h15-api-endpoint-worker\.flow$/);
  assert.match(endpoint.route.oracle, /h15-api-endpoint-oracle\.mjs$/);
  assert.ok(endpoint.escalationTriggers.includes('validation-semantic-miss'));

  assert.throws(() => resolveH15QwenCoderRoute('unknown-task'), /unknown H15 qwen3-coder task/);
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
  assert.equal(parsed.shouldRunHybrid, true);
  assert.equal(parsed.localDraftModel.name, 'qwen3-coder:30b');
  assert.equal(parsed.route.task, 'h15-api-endpoint');
  assert.equal(parsed.route.decision, 'hybrid-required');
});

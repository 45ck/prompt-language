import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  normalizeH11QwenCoderTask,
  resolveH11QwenCoderRoute,
} from './h11-qwen3-coder-routing-policy.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const POLICY_PATH = join(import.meta.dirname, 'h11-qwen3-coder-routing-policy.v1.json');

function readPolicy() {
  return JSON.parse(readFileSync(POLICY_PATH, 'utf8'));
}

function routeByTask(policy, task) {
  const route = policy.routes.find((entry) => entry.task === task);
  assert.ok(route, `missing route for ${task}`);
  return route;
}

test('H11 qwen3-coder policy exposes promoted multi-file refactor route', () => {
  const policy = readPolicy();
  assert.equal(policy.policyVersion, 'h11-qwen3-coder-multi-file-refactor-routing-v1');
  assert.equal(policy.model.name, 'qwen3-coder:30b');

  const route = routeByTask(policy, 'h11-multi-file-refactor');
  assert.equal(route.decision, 'local-promoted');
  assert.equal(route.owner, 'local');
  assert.equal(route.cleanPasses, 3);
  assert.equal(route.totalRuns, 5);
  assert.ok(route.requiredGuards.includes('behavior-preservation'));
  assert.match(route.fixture, /h11-multi-file-refactor$/);
  assert.match(route.flow, /h11-multi-file-refactor-worker\.flow$/);
  assert.match(route.oracle, /h11-multi-file-refactor-oracle\.mjs$/);
  assert.match(route.notes, /3\/5/);
  assert.match(route.notes, /now promoted/);
});

test('H11 qwen3-coder policy references checked-in evidence and harness files', () => {
  const policy = readPolicy();
  assert.ok(existsSync(join(ROOT, policy.evidence.summaryDoc)), 'summary evidence doc missing');
  assert.ok(
    existsSync(join(ROOT, policy.evidence.latestHarnessArenaLiveDoc)),
    'latest Harness Arena live doc missing',
  );
  assert.ok(existsSync(join(ROOT, policy.evidence.selectionDoc)), 'selection doc missing');

  for (const route of policy.routes) {
    assert.ok(existsSync(join(ROOT, route.fixture)), `${route.fixture} missing`);
    assert.ok(existsSync(join(ROOT, route.flow)), `${route.flow} missing`);
    assert.ok(existsSync(join(ROOT, route.oracle)), `${route.oracle} missing`);
  }
});

test('H11 qwen3-coder resolver maps aliases to promoted local decisions', () => {
  assert.equal(normalizeH11QwenCoderTask('h11'), 'h11-multi-file-refactor');
  assert.equal(normalizeH11QwenCoderTask('rename'), 'h11-multi-file-refactor');

  const resolved = resolveH11QwenCoderRoute('multi-file-refactor');
  assert.equal(resolved.shouldRunLocalScreen, false);
  assert.equal(resolved.shouldRunLocal, true);
  assert.equal(resolved.shouldRunFrontier, false);
  assert.equal(resolved.route.owner, 'local');
  assert.match(resolved.route.flow, /h11-multi-file-refactor-worker\.flow$/);

  assert.throws(() => resolveH11QwenCoderRoute('unknown-task'), /unknown H11 qwen3-coder task/);
});

test('H11 qwen3-coder resolver CLI emits JSON decisions', () => {
  const result = spawnSync(
    process.execPath,
    [join(import.meta.dirname, 'h11-qwen3-coder-routing-policy.mjs'), 'h11', '--json'],
    { encoding: 'utf8', windowsHide: true },
  );

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.shouldRunLocal, true);
  assert.equal(parsed.shouldRunLocalScreen, false);
  assert.equal(parsed.route.task, 'h11-multi-file-refactor');
});

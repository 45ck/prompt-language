// Orchestration unit tests for the E5 pair runner.
//
// Scope:
//   - Enumerate handler keys programmatically from the module (never hard-coded).
//   - Assert every manifest stage is wired to a handler.
//   - Verify the stage-loop propagates errors and preserves declared order.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { createStageHandlers, runStages, createPlan, formatPlan } from './run-pair.mjs';

function runNode(args, cwd) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => (stdout += c.toString()));
    child.stderr.on('data', (c) => (stderr += c.toString()));
    child.on('close', (code) => resolvePromise({ code, stdout, stderr }));
  });
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..');
const pairsDir = join(
  repoRoot,
  'experiments',
  'results',
  'e5-maintenance',
  'batches',
  'e5-b01-mv-gpt52-pilot',
  'pairs',
);

async function loadManifests() {
  const entries = await readdir(pairsDir);
  const jsonFiles = entries.filter((e) => e.endsWith('.json'));
  const manifests = [];
  for (const f of jsonFiles) {
    const full = join(pairsDir, f);
    const raw = await readFile(full, 'utf8');
    manifests.push({ file: f, path: full, manifest: JSON.parse(raw) });
  }
  return manifests;
}

test('createStageHandlers returns exactly the handler keys declared in the module', () => {
  const handlers = createStageHandlers();
  const keys = Object.keys(handlers).sort();
  // Enumerated programmatically — this assertion protects against silent
  // key drift. If this list changes, update the manifests or add a handler.
  assert.ok(keys.length > 0, 'handler map should not be empty');
  for (const key of keys) {
    assert.equal(
      typeof handlers[key],
      'function',
      `handler for ${key} should be a function, got ${typeof handlers[key]}`,
    );
  }
});

test('every stage.stage in each pair manifest is wired to a handler', async () => {
  const handlers = createStageHandlers();
  const handlerKeys = new Set(Object.keys(handlers));
  const manifests = await loadManifests();
  assert.ok(manifests.length >= 2, 'expected at least 2 pair manifests');
  for (const { file, manifest } of manifests) {
    assert.ok(Array.isArray(manifest.stages), `${file}: stages must be an array`);
    for (const stage of manifest.stages) {
      assert.ok(
        handlerKeys.has(stage.stage),
        `${file}: stage "${stage.stage}" has no handler (known: ${[...handlerKeys].join(', ')})`,
      );
    }
  }
});

test('runStages propagates handler errors', async () => {
  const manifest = {
    stages: [{ stage: 'alpha' }, { stage: 'beta' }],
  };
  const boom = new Error('handler-failed');
  const handlers = {
    alpha: async () => {
      throw boom;
    },
    beta: async () => {
      throw new Error('should-not-run');
    },
  };
  await assert.rejects(() => runStages(manifest, handlers, {}, {}), /handler-failed/);
});

test('runStages throws on unknown stage key', async () => {
  const manifest = { stages: [{ stage: 'does-not-exist' }] };
  await assert.rejects(() => runStages(manifest, {}, {}, {}), /unknown stage: does-not-exist/);
});

test('runStages dispatches handlers in declared manifest order', async () => {
  const manifests = await loadManifests();
  for (const { file, manifest } of manifests) {
    const calls = [];
    const spyHandlers = {};
    for (const stage of manifest.stages) {
      spyHandlers[stage.stage] = async (s) => {
        calls.push(s.stage);
      };
    }
    await runStages(manifest, spyHandlers, {}, {});
    const expected = manifest.stages.map((s) => s.stage);
    assert.deepEqual(calls, expected, `${file}: call order mismatch`);
  }
});

test('runStages honours dryRun by skipping handler invocation', async () => {
  const manifest = { stages: [{ stage: 'alpha' }, { stage: 'beta' }] };
  const calls = [];
  const handlers = {
    alpha: async () => calls.push('alpha'),
    beta: async () => calls.push('beta'),
  };
  await runStages(manifest, handlers, {}, { dryRun: true });
  assert.deepEqual(calls, [], 'handlers must not be called in dry-run');
});

test('createPlan emits stage descriptions and workspace paths', async () => {
  const manifests = await loadManifests();
  const { manifest } = manifests[0];
  const runDir = '/tmp/fake-run-dir';
  const plan = createPlan(manifest, runDir);
  assert.equal(plan.pairId, manifest.pairId);
  assert.equal(plan.runDir, runDir);
  assert.equal(plan.stages.length, manifest.stages.length);
  for (const [i, s] of plan.stages.entries()) {
    assert.equal(s.stage, manifest.stages[i].stage);
    assert.equal(s.known, true, `stage ${s.stage} should have a registered description`);
    assert.ok(s.description.length > 0);
  }
  assert.ok(plan.workspaces.some((w) => w.includes('codex-workspace')));
  assert.ok(plan.workspaces.some((w) => w.includes('pl-workspace-stripped')));
  const text = formatPlan(plan);
  assert.match(text, /pair:/);
  assert.match(text, /stages:/);
  assert.match(text, /workspace paths/);
});

test('--plan subprocess prints stage list for each pair manifest and exits 0', async () => {
  const manifests = await loadManifests();
  const runnerPath = join(__dirname, 'run-pair.mjs');
  for (const { file, manifest } of manifests) {
    // Manifest path passed relative to repoRoot (matching the runner's CLI).
    const relManifest = join(
      'experiments',
      'results',
      'e5-maintenance',
      'batches',
      'e5-b01-mv-gpt52-pilot',
      'pairs',
      file,
    );
    const { code, stdout, stderr } = await runNode([runnerPath, relManifest, '--plan'], repoRoot);
    assert.equal(code, 0, `--plan should exit 0 for ${file}; stderr=${stderr} stdout=${stdout}`);
    assert.match(stdout, /pair:\s*\S+/, `missing pair line for ${file}`);
    assert.match(stdout, /stages:/);
    assert.match(stdout, /workspace paths/);
    for (const stage of manifest.stages) {
      assert.ok(
        stdout.includes(stage.stage),
        `--plan output should mention stage "${stage.stage}" for ${file}`,
      );
    }
  }
});

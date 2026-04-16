// run-meta-experiment.test.mjs — node:test for dry-run mode.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import {
  deriveClaimEligibility,
  deleteRunNonce,
  liveRun,
  main,
  readRunNonce,
  resolveNonceStoreDir,
  summarizeBootstrapPreflight,
  writeRunNonce,
} from './run-meta-experiment.mjs';
import { computeManifest } from './compute-manifest.mjs';
import { diffManifests } from './manifest-diff.mjs';

test('dry-run against a tiny fake flow parses and reports prerequisites', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'meta-dry-'));
  const flow = join(dir, 'tiny.flow');
  writeFileSync(
    flow,
    `Goal: tiny meta dry run

flow:
  let hello = "world"
  prompt: Say \${hello}.
`,
  );
  // Redirect stdout capture via a simple override
  const origWrite = process.stdout.write.bind(process.stdout);
  let captured = '';
  process.stdout.write = (chunk, ...rest) => {
    captured += typeof chunk === 'string' ? chunk : chunk.toString();
    return origWrite(chunk, ...rest);
  };
  try {
    const result = await main([flow]);
    assert.equal(result.mode, 'dry-run');
    assert.equal(result.parse.ok, true, 'flow must parse');
    assert.ok(result.parse.nodeCount >= 2, 'expected at least 2 nodes');
    assert.ok(Array.isArray(result.imports));
    assert.ok(captured.includes('"mode":"dry-run"'), 'stdout summary present');
  } finally {
    process.stdout.write = origWrite;
  }
});

test('manifest diff detects protected-config changes', () => {
  const pre = { 'package.json': 'aaa', 'src/x.ts': 'hhh' };
  const post = { 'package.json': 'bbb', 'src/x.ts': 'hhh', 'src/new.ts': 'ccc' };
  const d = diffManifests(pre, post);
  assert.deepEqual(d.changed, ['package.json']);
  assert.deepEqual(d.added, ['src/new.ts']);
  assert.deepEqual(d.removed, []);
  assert.ok(d.protectedChanged.includes('package.json'));
});

test('computeManifest returns SHA-256 entries and skips node_modules', () => {
  const dir = mkdtempSync(join(tmpdir(), 'meta-mf-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'a.ts'), 'export const a = 1;');
  writeFileSync(join(dir, 'package.json'), '{"name":"t"}');
  mkdirSync(join(dir, 'node_modules'));
  writeFileSync(join(dir, 'node_modules', 'ignored'), 'x');
  const m = computeManifest(dir);
  assert.ok('src/a.ts' in m);
  assert.ok('package.json' in m);
  assert.ok(!Object.keys(m).some((k) => k.startsWith('node_modules')));
  assert.match(m['package.json'], /^[0-9a-f]{64}$/);
});

test('writeRunNonce uses a private nonce store and 64-hex nonce content', () => {
  const dir = mkdtempSync(join(tmpdir(), 'meta-nonce-'));
  const prev = process.env.PL_META_NONCE_DIR;
  process.env.PL_META_NONCE_DIR = dir;

  try {
    assert.equal(resolveNonceStoreDir(), dir);
    const { nonce, noncePath } = writeRunNonce('run-1');

    assert.equal(noncePath.startsWith(dir), true, 'nonce must live under configured store');
    assert.match(nonce, /^[0-9a-f]{64}$/);
    assert.match(basename(noncePath), /^[0-9a-f]{64}\.nonce$/);
    assert.equal(readRunNonce(noncePath), nonce);
    assert.equal(existsSync(noncePath), true);

    if (process.platform !== 'win32') {
      const storeMode = statSync(dir).mode & 0o777;
      const fileMode = statSync(noncePath).mode & 0o777;
      assert.equal(storeMode, 0o700);
      assert.equal(fileMode, 0o600);
    }

    deleteRunNonce(noncePath);
    assert.equal(existsSync(noncePath), false, 'nonce file should be deleted');
  } finally {
    if (prev === undefined) delete process.env.PL_META_NONCE_DIR;
    else process.env.PL_META_NONCE_DIR = prev;
  }
});

test('summarizeBootstrapPreflight extracts blocked and warning items', () => {
  const summary = summarizeBootstrapPreflight({
    overall: 'blocked',
    items: [
      { id: 1, name: 'pinned runtime', status: 'blocked', detail: 'rebuild required' },
      { id: 4, name: 'resource caps', status: 'warn', detail: 'defaults apply' },
      { id: 8, name: 'post-run verifier', status: 'unchecked', detail: 'post-run only' },
    ],
    nextActions: ['do the thing'],
  });

  assert.equal(summary.overall, 'blocked');
  assert.deepEqual(summary.blockedItems, [
    { id: 1, name: 'pinned runtime', detail: 'rebuild required' },
  ]);
  assert.deepEqual(summary.warningItems, [
    { id: 4, name: 'resource caps', detail: 'defaults apply' },
  ]);
  assert.deepEqual(summary.nextActions, ['do the thing']);
});

test('deriveClaimEligibility marks degraded preflight as ineligible even when the run otherwise passes', () => {
  const eligibility = deriveClaimEligibility({
    bootstrapOverall: 'degraded',
    verifyOk: true,
    ruleWeakening: false,
    timedOut: false,
    errorStr: null,
    nonceMismatch: false,
  });

  assert.deepEqual(eligibility, {
    eligible: false,
    status: 'ineligible',
    blockers: ['bootstrap-preflight-degraded'],
  });
});

test('liveRun short-circuits on blocked bootstrap preflight and persists the report', async () => {
  const bundleDir = mkdtempSync(join(tmpdir(), 'meta-live-blocked-'));
  let launchAttempted = false;
  const bootstrapReport = {
    overall: 'blocked',
    items: [{ id: 6, name: 'cross-family reviewer', status: 'blocked', detail: 'same family' }],
    nextActions: ['pick a cross-family reviewer'],
  };

  const result = await liveRun(
    {
      flowText: 'Goal: blocked live run',
      runId: 'meta-test-blocked',
      wallClockSec: 1,
      bundleDirOverride: bundleDir,
    },
    {
      ensureCliInstalledFn: () => ({ installed: true, ranInstall: false }),
      checkShimFn: () => ({ exists: true }),
      checkClaudeAuthFn: () => ({ claudeBin: '/fake/claude', authenticated: true }),
      runBootstrapPreflightFn: () => bootstrapReport,
      runLiveFn: async () => {
        launchAttempted = true;
        return { exitCode: 0, signal: null, timedOut: false };
      },
    },
  );

  assert.equal(result.success, false);
  assert.equal(result.reason, 'bootstrap-preflight-blocked');
  assert.equal(result.launch.attempted, false);
  assert.equal(launchAttempted, false, 'claude launch must not be attempted');
  assert.deepEqual(result.claimEligibility, {
    eligible: false,
    status: 'ineligible',
    blockers: ['bootstrap-preflight-blocked'],
  });

  const persisted = JSON.parse(readFileSync(join(bundleDir, 'bootstrap-preflight.json'), 'utf8'));
  assert.deepEqual(persisted, bootstrapReport);
  const summary = JSON.parse(readFileSync(join(bundleDir, 'report.json'), 'utf8'));
  assert.equal(summary.reason, 'bootstrap-preflight-blocked');
  assert.deepEqual(summary.launch.blockedBy, [
    { id: 6, name: 'cross-family reviewer', detail: 'same family' },
  ]);
});

// Tests for the META-5 bootstrap-envelope preflight checker.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { runPreflight } from './bootstrap-envelope.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, 'bootstrap-envelope.mjs');

// Env that would otherwise leak into every assertion. Clearing gives
// deterministic "defaults" for item 4/6/7 regardless of host shell.
const ENV_KEYS = [
  'PL_META_SANDBOX',
  'META_WALL_CLOCK_SEC',
  'META_TOKEN_CAP',
  'META_EVENT_CAP',
  'PL_META_DEPTH',
  'META_FS_GROWTH_MB',
  'PL_REVIEWER_FAMILY',
  'PL_FACTORY_FAMILY',
  'PL_APPROVE_DESTRUCTIVE',
];

function baseEnv(overrides = {}) {
  const env = { ...process.env };
  for (const k of ENV_KEYS) delete env[k];
  return { ...env, ...overrides };
}

function fullyConfiguredEnv() {
  return baseEnv({
    PL_META_SANDBOX: 'firejail',
    META_WALL_CLOCK_SEC: '600',
    META_TOKEN_CAP: '200000',
    META_EVENT_CAP: '5000',
    PL_META_DEPTH: '1',
    META_FS_GROWTH_MB: '50',
    PL_REVIEWER_FAMILY: 'openai',
    PL_FACTORY_FAMILY: 'anthropic',
    PL_APPROVE_DESTRUCTIVE: 'never',
  });
}

test('produces all 8 envelope items in correct shape', () => {
  const report = runPreflight({ env: baseEnv() });
  assert.equal(report.items.length, 8);
  for (let i = 0; i < 8; i += 1) {
    const it = report.items[i];
    assert.equal(it.id, i + 1, `item ${i + 1} id mismatch`);
    assert.equal(typeof it.name, 'string');
    assert.match(it.status, /^(ready|warn|blocked|unchecked)$/);
    assert.equal(typeof it.detail, 'string');
  }
  assert.match(report.overall, /^(ready|degraded|blocked)$/);
  assert.ok(Array.isArray(report.nextActions));
});

test('fully-configured env plus real repo reports ready or degraded (item 8 is unchecked)', () => {
  // Item 8 is always "unchecked" by design, which does not block or degrade.
  const report = runPreflight({ env: fullyConfiguredEnv() });
  // If dist/ is present the repo-side items pass; if not, this is blocked.
  // We assert the env-sensitive items specifically.
  const byId = Object.fromEntries(report.items.map((i) => [i.id, i]));
  assert.equal(byId[2].status, 'ready');
  assert.equal(byId[4].status, 'ready');
  assert.equal(byId[6].status, 'ready');
  assert.equal(byId[7].status, 'ready');
  assert.equal(byId[8].status, 'unchecked');
});

test('known different families normalize to canonical ids and item 6 is ready', () => {
  const env = fullyConfiguredEnv();
  env.PL_FACTORY_FAMILY = 'Claude Sonnet';
  env.PL_REVIEWER_FAMILY = 'gpt-5';
  const report = runPreflight({ env });
  const item6 = report.items.find((i) => i.id === 6);
  assert.equal(item6.status, 'ready');
  assert.equal(item6.factoryFamily, 'anthropic');
  assert.equal(item6.reviewerFamily, 'openai');
  assert.match(item6.detail, /factory=anthropic reviewer=openai/);
});

test('missing dist/ → item 1 blocked and overall blocked', () => {
  const fakeRoot = mkdtempSync(join(tmpdir(), 'envelope-'));
  try {
    const report = runPreflight({ repoRoot: fakeRoot, env: fullyConfiguredEnv() });
    const item1 = report.items.find((i) => i.id === 1);
    assert.equal(item1.status, 'blocked');
    assert.match(item1.detail, /dist\//);
    assert.equal(report.overall, 'blocked');
  } finally {
    rmSync(fakeRoot, { recursive: true, force: true });
  }
});

test('unset PL_REVIEWER_FAMILY → item 6 warn, overall degraded (when no blocks)', () => {
  const env = fullyConfiguredEnv();
  delete env.PL_REVIEWER_FAMILY;
  const report = runPreflight({ env });
  const item6 = report.items.find((i) => i.id === 6);
  assert.equal(item6.status, 'warn');
  assert.match(item6.detail, /PL_REVIEWER_FAMILY/);
  // overall depends on item 1; if dist is present this is degraded. If dist
  // is missing the test is inconclusive for overall, so guard.
  const item1 = report.items.find((i) => i.id === 1);
  if (item1.status !== 'blocked') {
    assert.equal(report.overall, 'degraded');
  }
});

test('matching factory=reviewer family → item 6 blocked, overall blocked', () => {
  const env = fullyConfiguredEnv();
  env.PL_FACTORY_FAMILY = 'gpt-5';
  env.PL_REVIEWER_FAMILY = 'OpenAI';
  const report = runPreflight({ env });
  const item6 = report.items.find((i) => i.id === 6);
  assert.equal(item6.status, 'blocked');
  assert.match(item6.detail, /family separation violated/i);
  assert.equal(report.overall, 'blocked');
});

test('unrecognized family declaration → item 6 blocked with known-family guidance', () => {
  const env = fullyConfiguredEnv();
  env.PL_FACTORY_FAMILY = 'open-weight';
  const report = runPreflight({ env });
  const item6 = report.items.find((i) => i.id === 6);
  assert.equal(item6.status, 'blocked');
  assert.match(item6.detail, /PL_FACTORY_FAMILY/);
  assert.match(item6.detail, /unrecognized family/i);
  assert.match(item6.detail, /anthropic/);
  assert.equal(report.overall, 'blocked');
});

test('--bundle materializes manifest-pre.json with sha256 entries', () => {
  const bundleDir = mkdtempSync(join(tmpdir(), 'envelope-bundle-'));
  try {
    const report = runPreflight({ env: fullyConfiguredEnv(), bundleDir });
    const manifestPath = join(bundleDir, 'manifest-pre.json');
    assert.ok(existsSync(manifestPath), 'manifest-pre.json should exist');
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.ok(Array.isArray(parsed.entries) && parsed.entries.length > 0);
    for (const entry of parsed.entries) {
      assert.equal(typeof entry.path, 'string');
      assert.match(entry.sha256, /^[0-9a-f]{64}$/);
    }
    const item3 = report.items.find((i) => i.id === 3);
    assert.equal(item3.status, 'ready');
    assert.equal(item3.manifestPath, manifestPath);
  } finally {
    rmSync(bundleDir, { recursive: true, force: true });
  }
});

test('CLI exits 1 when blocked and 0 when ready/degraded', () => {
  // Use a dummy repo root (no dist) to force a block; we run the CLI with
  // cwd set there so relative bundle paths behave, but bundle isn't used here.
  const fakeRoot = mkdtempSync(join(tmpdir(), 'envelope-cli-'));
  try {
    // The CLI uses its own script-location-derived REPO_ROOT, so forcing a
    // block via repoRoot isn't possible through the CLI. Instead, force
    // block via env: identical reviewer/factory families.
    const env = fullyConfiguredEnv();
    env.PL_FACTORY_FAMILY = 'openai';
    env.PL_REVIEWER_FAMILY = 'openai';
    const blocked = spawnSync(process.execPath, [CLI, '--json'], { env, encoding: 'utf8' });
    assert.equal(blocked.status, 1, `stderr=${blocked.stderr}`);
    const blockedReport = JSON.parse(blocked.stdout);
    assert.equal(blockedReport.overall, 'blocked');

    const ok = spawnSync(process.execPath, [CLI, '--json'], {
      env: fullyConfiguredEnv(),
      encoding: 'utf8',
    });
    const okReport = JSON.parse(ok.stdout);
    // Exit code must correlate with overall: blocked→1, ready/degraded→0.
    // We assert the invariant rather than force a specific overall, because
    // item 1 depends on whether dist/domain/state-hash.js exists in the host repo.
    if (okReport.overall === 'blocked') {
      assert.equal(ok.status, 1, `stderr=${ok.stderr}`);
    } else {
      assert.equal(ok.status, 0, `stderr=${ok.stderr}`);
    }
  } finally {
    rmSync(fakeRoot, { recursive: true, force: true });
  }
});

test('CLI rejects unknown args with exit 2', () => {
  const res = spawnSync(process.execPath, [CLI, '--nope'], { encoding: 'utf8' });
  assert.equal(res.status, 2);
  assert.match(res.stderr, /unknown argument/);
});

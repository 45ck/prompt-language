import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GUARD_SCRIPT = join(ROOT, 'scripts', 'ci', 'beads-backup-guard.mjs');

function git(cwd, args) {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

function writeConfig(cwd, { issuePrefix = 'prompt-language', schemaVersion = '9' } = {}) {
  writeFileSync(
    join(cwd, '.beads', 'backup', 'config.jsonl'),
    [
      '{"key":"auto_compact_enabled","value":"false"}',
      `{"key":"issue_prefix","value":"${issuePrefix}"}`,
      `{"key":"schema_version","value":"${schemaVersion}"}`,
    ].join('\n'),
  );
}

function writeState(cwd, eventCount) {
  writeFileSync(
    join(cwd, '.beads', 'backup', 'backup_state.json'),
    JSON.stringify(
      {
        last_dolt_commit: 'test',
        timestamp: '2026-04-24T00:00:00.000Z',
        counts: {
          issues: 1,
          events: eventCount,
          comments: 0,
          dependencies: 0,
          labels: 0,
          config: 3,
        },
      },
      null,
      2,
    ),
  );
}

function createRepo() {
  const cwd = join(tmpdir(), `beads-backup-guard-${process.pid}-${Date.now()}`);
  mkdirSync(join(cwd, '.beads', 'backup'), { recursive: true });
  git(cwd, ['init']);
  git(cwd, ['config', 'user.email', 'test@example.invalid']);
  git(cwd, ['config', 'user.name', 'Test User']);
  writeConfig(cwd);
  writeState(cwd, 10);
  git(cwd, ['add', '.']);
  git(cwd, ['commit', '-m', 'test: seed beads backup']);
  return cwd;
}

function runGuard(cwd) {
  return spawnSync(process.execPath, [GUARD_SCRIPT], {
    cwd,
    encoding: 'utf8',
  });
}

test('passes for committed prompt-language schema 9 backup config', () => {
  const cwd = createRepo();
  try {
    const result = runGuard(cwd);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('fails when staged backup config changes issue prefix', () => {
  const cwd = createRepo();
  try {
    writeConfig(cwd, { issuePrefix: 'prompt', schemaVersion: '9' });
    git(cwd, ['add', '.beads/backup/config.jsonl']);

    const result = runGuard(cwd);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /issue_prefix must remain "prompt-language"/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('fails when staged backup config downgrades schema version', () => {
  const cwd = createRepo();
  try {
    writeConfig(cwd, { issuePrefix: 'prompt-language', schemaVersion: '7' });
    git(cwd, ['add', '.beads/backup/config.jsonl']);

    const result = runGuard(cwd);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /schema_version must be >= 9/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('fails when staged backup state decreases event count', () => {
  const cwd = createRepo();
  try {
    writeState(cwd, 5);
    git(cwd, ['add', '.beads/backup/backup_state.json']);

    const result = runGuard(cwd);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /events count must not decrease \(10 -> 5\)/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

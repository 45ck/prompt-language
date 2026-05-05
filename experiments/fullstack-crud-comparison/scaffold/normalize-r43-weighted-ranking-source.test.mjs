// cspell:ignore fscrud

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'normalize-r43-weighted-ranking-source.cjs',
);
const VERIFY_SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'verify-r43-weighted-ranking-source.cjs',
);

const VALID_RANKING = [
  '1=bravo-protected-crud-kernel',
  '2=charlie-editable-manual-plan',
  '3=alpha-frontend-notes-plan',
].join('\n');

function withWorkspace(ranking, callback) {
  const root = mkdtempSync(join(tmpdir(), 'r43-normalize-'));
  const workspace = join(root, 'workspace', 'fscrud-01');
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(workspace, 'senior-plan.ranking.txt'), ranking, 'utf8');
  try {
    callback(root, workspace);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('normalizes correct weighted ranking into canonical R43 sources', () => {
  withWorkspace(VALID_RANKING, (root, workspace) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /r43_weighted_ranking_normalized:3\/3/);

    const raw = JSON.parse(readFileSync(join(workspace, 'senior-plan.raw.json'), 'utf8'));
    assert.equal(raw.selectedRanking[0], 'bravo-protected-crud-kernel');
    assert.equal(raw.weightedCriteria.protectedLocalOnly, 5);

    const source = JSON.parse(readFileSync(join(workspace, 'handoff-source.json'), 'utf8'));
    assert.equal(source.experimentArm, 'r43-pl-weighted-ranking-senior-plan-source');
    assert.deepEqual(source.modelOwnedFiles, ['senior-plan.ranking.txt']);

    const verify = spawnSync(process.execPath, [VERIFY_SCRIPT, 'workspace/fscrud-01'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(verify.status, 0, verify.stderr);
  });
});

test('normalizes compact local ranking output', () => {
  withWorkspace('bravo, charlie, alpha', (root, workspace) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    const raw = JSON.parse(readFileSync(join(workspace, 'senior-plan.raw.json'), 'utf8'));
    assert.deepEqual(raw.selectedRanking, [
      'bravo-protected-crud-kernel',
      'charlie-editable-manual-plan',
      'alpha-frontend-notes-plan',
    ]);
  });
});

test('rejects wrong weighted ranking order', () => {
  withWorkspace('alpha, bravo, charlie', (root) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01', '--check-only'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /weighted_ranking_mismatch:0\/3/);
  });
});

test('rejects empty weighted ranking files', () => {
  withWorkspace('', (root) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01', '--check-only'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /ranking_source_empty/);
  });
});

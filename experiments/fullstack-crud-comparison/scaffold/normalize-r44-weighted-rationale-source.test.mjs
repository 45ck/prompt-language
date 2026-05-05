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
  'normalize-r44-weighted-rationale-source.cjs',
);
const VERIFY_SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'verify-r44-weighted-rationale-source.cjs',
);

const VALID_RATIONALE = [
  '1=bravo-protected-crud-kernel because protected local files cover domain UI server seed, ordered CRUD, domain checks and tests, path seed schema handoff risk.',
  '2=charlie-editable-manual-plan because it has some product coverage but weaker manual verification.',
  '3=alpha-frontend-notes-plan because frontend notes miss domain server seed and ordered work.',
].join('\n');

function withWorkspace(rationale, callback) {
  const root = mkdtempSync(join(tmpdir(), 'r44-normalize-'));
  const workspace = join(root, 'workspace', 'fscrud-01');
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(workspace, 'senior-plan.rationale.txt'), rationale, 'utf8');
  try {
    callback(root, workspace);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('normalizes correct weighted rationale into canonical R44 sources', () => {
  withWorkspace(VALID_RATIONALE, (root, workspace) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /r44_weighted_rationale_normalized:8\/8/);

    const raw = JSON.parse(readFileSync(join(workspace, 'senior-plan.raw.json'), 'utf8'));
    assert.equal(raw.selectedRanking[0], 'bravo-protected-crud-kernel');
    assert.match(raw.rationaleEvidence, /protected local/u);

    const source = JSON.parse(readFileSync(join(workspace, 'handoff-source.json'), 'utf8'));
    assert.equal(source.experimentArm, 'r44-pl-weighted-rationale-senior-plan-source');
    assert.deepEqual(source.modelOwnedFiles, ['senior-plan.rationale.txt']);

    const verify = spawnSync(process.execPath, [VERIFY_SCRIPT, 'workspace/fscrud-01'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(verify.status, 0, verify.stderr);
  });
});

test('rejects correct ranking with missing rationale terms', () => {
  withWorkspace('1=bravo\n2=charlie\n3=alpha', (root) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01', '--check-only'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /weighted_rationale_terms_missing/);
  });
});

test('rejects wrong weighted rationale order', () => {
  withWorkspace(VALID_RATIONALE.replace('1=bravo-protected-crud-kernel', '1=alpha'), (root) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01', '--check-only'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /weighted_rationale_ranking_mismatch/);
  });
});

test('rejects empty weighted rationale files', () => {
  withWorkspace('', (root) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01', '--check-only'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /rationale_source_empty/);
  });
});

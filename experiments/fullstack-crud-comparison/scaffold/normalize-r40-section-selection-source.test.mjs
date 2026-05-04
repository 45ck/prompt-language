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
  'normalize-r40-section-selection-source.cjs',
);
const VERIFY_SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'verify-r40-section-selection-source.cjs',
);

function withWorkspace(selection, callback) {
  const root = mkdtempSync(join(tmpdir(), 'r40-normalize-'));
  const workspace = join(root, 'workspace', 'fscrud-01');
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(workspace, 'senior-plan.selection.txt'), selection, 'utf8');
  try {
    callback(root, workspace);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('normalizes complete section selections into canonical R40 sources', () => {
  withWorkspace(
    'objective constraints architecture implementation verification risk',
    (root, workspace) => {
      const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01'], {
        cwd: root,
        encoding: 'utf8',
      });

      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /r40_section_selection_normalized:6\/6/);

      const raw = JSON.parse(readFileSync(join(workspace, 'senior-plan.raw.json'), 'utf8'));
      assert.match(raw.objective, /field service work order/);

      const source = JSON.parse(readFileSync(join(workspace, 'handoff-source.json'), 'utf8'));
      assert.equal(source.experimentArm, 'r40-pl-section-selected-senior-plan-source');
      assert.deepEqual(source.modelOwnedFiles, ['senior-plan.selection.txt']);

      const verify = spawnSync(process.execPath, [VERIFY_SCRIPT, 'workspace/fscrud-01'], {
        cwd: root,
        encoding: 'utf8',
      });
      assert.equal(verify.status, 0, verify.stderr);
    },
  );
});

test('rejects incomplete section selections', () => {
  withWorkspace('objective constraints architecture', (root) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01', '--check-only'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /section_selection_incomplete:3\/6/);
    assert.match(result.stderr, /implementation,verification,risk/);
  });
});

test('rejects empty section selection files', () => {
  withWorkspace('', (root) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01', '--check-only'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /selection_source_empty/);
  });
});

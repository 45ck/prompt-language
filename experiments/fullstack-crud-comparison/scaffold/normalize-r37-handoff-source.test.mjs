// cspell:ignore fscrud

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'normalize-r37-handoff-source.cjs');
const VERIFY_SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'verify-r37-handoff-source.cjs',
);

function withWorkspace(raw, callback) {
  const root = mkdtempSync(join(tmpdir(), 'r37-normalize-'));
  const workspace = join(root, 'workspace', 'fscrud-01');
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(workspace, 'handoff-source.raw.json'), raw, 'utf8');
  try {
    callback(root, workspace);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('normalizes repairable raw handoff intent into canonical R37 source', () => {
  withWorkspace(
    JSON.stringify({
      intent:
        'local deterministic domain UI server handoff rendered artifacts handoff-source.raw.json',
    }),
    (root, workspace) => {
      const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01'], {
        cwd: root,
        encoding: 'utf8',
      });

      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /r37_handoff_source_normalized/);

      const source = JSON.parse(readFileSync(join(workspace, 'handoff-source.json'), 'utf8'));
      assert.equal(source.experimentArm, 'r37-pl-schema-repaired-handoff-source');
      assert.deepEqual(source.modelOwnedFiles, ['handoff-source.raw.json']);

      const verify = spawnSync(process.execPath, [VERIFY_SCRIPT, 'workspace/fscrud-01'], {
        cwd: root,
        encoding: 'utf8',
      });
      assert.equal(verify.status, 0, verify.stderr);
    },
  );
});

test('rejects raw handoff intent that omits required product-boundary terms', () => {
  withWorkspace('local deterministic handoff only', (root) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01', '--check-only'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /raw_source_missing_term:domain/);
  });
});

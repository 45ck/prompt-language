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
  'normalize-r41-decision-matrix-source.cjs',
);
const VERIFY_SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'verify-r41-decision-matrix-source.cjs',
);

const VALID_DECISIONS = [
  'objective=field-service-work-orders',
  'constraints=protected-local-only',
  'architecture=domain-ui-server-seed',
  'implementation=ordered-crud-relationships',
  'verification=domain-checks-and-tests',
  'risk=path-seed-schema-handoff',
].join('\n');

function withWorkspace(decisions, callback) {
  const root = mkdtempSync(join(tmpdir(), 'r41-normalize-'));
  const workspace = join(root, 'workspace', 'fscrud-01');
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(workspace, 'senior-plan.decisions.txt'), decisions, 'utf8');
  try {
    callback(root, workspace);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('normalizes correct decision matrix choices into canonical R41 sources', () => {
  withWorkspace(VALID_DECISIONS, (root, workspace) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /r41_decision_matrix_normalized:6\/6/);

    const raw = JSON.parse(readFileSync(join(workspace, 'senior-plan.raw.json'), 'utf8'));
    assert.equal(raw.selectedDecisions.objective, 'field-service-work-orders');

    const source = JSON.parse(readFileSync(join(workspace, 'handoff-source.json'), 'utf8'));
    assert.equal(source.experimentArm, 'r41-pl-decision-matrix-senior-plan-source');
    assert.deepEqual(source.modelOwnedFiles, ['senior-plan.decisions.txt']);

    const verify = spawnSync(process.execPath, [VERIFY_SCRIPT, 'workspace/fscrud-01'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(verify.status, 0, verify.stderr);
  });
});

test('rejects wrong decision matrix choices', () => {
  withWorkspace(
    VALID_DECISIONS.replace('field-service-work-orders', 'generic-blog-crud'),
    (root) => {
      const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01', '--check-only'], {
        cwd: root,
        encoding: 'utf8',
      });

      assert.equal(result.status, 1);
      assert.match(result.stderr, /decision_matrix_mismatch:5\/6/);
      assert.match(result.stderr, /objective:generic-blog-crud!=field-service-work-orders/);
    },
  );
});

test('rejects empty decision matrix files', () => {
  withWorkspace('', (root) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01', '--check-only'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /decision_source_empty/);
  });
});

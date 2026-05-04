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
  'normalize-r39-quality-senior-plan-source.cjs',
);
const VERIFY_SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'verify-r39-quality-senior-plan-source.cjs',
);

function withWorkspace(raw, callback) {
  const root = mkdtempSync(join(tmpdir(), 'r39-normalize-'));
  const workspace = join(root, 'workspace', 'fscrud-01');
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(workspace, 'senior-plan.raw.json'), raw, 'utf8');
  try {
    callback(root, workspace);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('normalizes quality-scored senior plan intent into canonical R39 source', () => {
  withWorkspace(
    JSON.stringify({
      intent:
        'objective field service work order customer asset constraints protected local-only do not edit deterministic rendered architecture domain UI server seed implementation ordered create read edit delete relationship verification check:domain:exports check:domain:customer check:domain:assets check:domain:work-orders npm test risk path isolation seed integrity domain behavior schema handoff senior-plan.raw.json local deterministic rendered artifacts',
    }),
    (root, workspace) => {
      const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01'], {
        cwd: root,
        encoding: 'utf8',
      });

      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /r39_senior_plan_source_normalized:29\/29/);

      const source = JSON.parse(readFileSync(join(workspace, 'handoff-source.json'), 'utf8'));
      assert.equal(source.experimentArm, 'r39-pl-quality-scored-senior-plan-source');
      assert.deepEqual(source.modelOwnedFiles, ['senior-plan.raw.json']);

      const verify = spawnSync(process.execPath, [VERIFY_SCRIPT, 'workspace/fscrud-01'], {
        cwd: root,
        encoding: 'utf8',
      });
      assert.equal(verify.status, 0, verify.stderr);
    },
  );
});

test('rejects shallow senior plan intent below quality threshold', () => {
  withWorkspace(
    'objective constraints architecture implementation verification risk local deterministic domain UI server handoff senior-plan.raw.json',
    (root) => {
      const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01', '--check-only'], {
        cwd: root,
        encoding: 'utf8',
      });

      assert.equal(result.status, 1);
      assert.match(result.stderr, /senior_plan_quality_score_too_low/);
    },
  );
});

test('rejects raw senior plan intent that omits required product-boundary terms', () => {
  withWorkspace('local deterministic handoff only', (root) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01', '--check-only'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /raw_source_missing_term:domain/);
  });
});

test('rejects senior plan intent that omits the model-owned filename', () => {
  withWorkspace(
    'objective constraints architecture implementation verification risk local deterministic domain UI server handoff',
    (root) => {
      const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01', '--check-only'], {
        cwd: root,
        encoding: 'utf8',
      });

      assert.equal(result.status, 1);
      assert.match(result.stderr, /raw_source_missing_term:senior-plan\.raw\.json/);
    },
  );
});

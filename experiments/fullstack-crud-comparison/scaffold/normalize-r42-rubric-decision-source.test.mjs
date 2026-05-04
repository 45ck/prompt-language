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
  'normalize-r42-rubric-decision-source.cjs',
);
const VERIFY_SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'verify-r42-rubric-decision-source.cjs',
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
  const root = mkdtempSync(join(tmpdir(), 'r42-normalize-'));
  const workspace = join(root, 'workspace', 'fscrud-01');
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(workspace, 'senior-plan.decisions.txt'), decisions, 'utf8');
  try {
    callback(root, workspace);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('normalizes correct rubric decision choices into canonical R42 sources', () => {
  withWorkspace(VALID_DECISIONS, (root, workspace) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /r42_rubric_decision_normalized:6\/6/);

    const raw = JSON.parse(readFileSync(join(workspace, 'senior-plan.raw.json'), 'utf8'));
    assert.equal(raw.selectedDecisions.risk, 'path-seed-schema-handoff');

    const source = JSON.parse(readFileSync(join(workspace, 'handoff-source.json'), 'utf8'));
    assert.equal(source.experimentArm, 'r42-pl-rubric-decision-senior-plan-source');
    assert.deepEqual(source.modelOwnedFiles, ['senior-plan.decisions.txt']);

    const verify = spawnSync(process.execPath, [VERIFY_SCRIPT, 'workspace/fscrud-01'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(verify.status, 0, verify.stderr);
  });
});

test('rejects wrong rubric decision choices', () => {
  withWorkspace(
    VALID_DECISIONS.replace('domain-checks-and-tests', 'manual-inspection-only'),
    (root) => {
      const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01', '--check-only'], {
        cwd: root,
        encoding: 'utf8',
      });

      assert.equal(result.status, 1);
      assert.match(result.stderr, /rubric_decision_mismatch:5\/6/);
      assert.match(result.stderr, /verification:manual-inspection-only!=domain-checks-and-tests/);
    },
  );
});

test('normalizes ordered rubric decision lists from local output', () => {
  const ordered =
    'field-service CRUD, protected-local-only, domain-ui-server-seed, ordered-crud-relationships, domain-checks-and-tests, path-seed-schema-handoff';

  withWorkspace(ordered, (root, workspace) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    const raw = JSON.parse(readFileSync(join(workspace, 'senior-plan.raw.json'), 'utf8'));
    assert.equal(raw.selectedDecisions.objective, 'field-service-work-orders');
    assert.equal(raw.selectedDecisions.risk, 'path-seed-schema-handoff');
  });
});

test('rejects ordered rubric decision lists with wrong choices', () => {
  const ordered =
    'field-service CRUD, protected-local-only, domain-ui-server-seed, ordered-crud-relationships, manual-inspection-only, path-seed-schema-handoff';

  withWorkspace(ordered, (root) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01', '--check-only'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /rubric_decision_mismatch:5\/6/);
  });
});

test('rejects empty rubric decision files', () => {
  withWorkspace('', (root) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01', '--check-only'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /decision_source_empty/);
  });
});

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
  'normalize-r45-risk-response-source.cjs',
);
const VERIFY_SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'verify-r45-risk-response-source.cjs',
);

const VALID_RESPONSE = [
  '1=guard-path-seed-schema-handoff because path root isolation, seed integrity, schema repair, handoff artifacts, deterministic verification, and protected local scope reduce the known risk.',
  '2=expand-editable-product-scope because broader local edits can help only after protected checks are stable.',
  '3=defer-verification-to-manual-review because manual review is weaker than deterministic verification.',
].join('\n');

function withWorkspace(response, callback) {
  const root = mkdtempSync(join(tmpdir(), 'r45-normalize-'));
  const workspace = join(root, 'workspace', 'fscrud-01');
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(workspace, 'senior-plan.risk-response.txt'), response, 'utf8');
  try {
    callback(root, workspace);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('normalizes correct risk response into canonical R45 sources', () => {
  withWorkspace(VALID_RESPONSE, (root, workspace) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /r45_risk_response_normalized:9\/9/);

    const raw = JSON.parse(readFileSync(join(workspace, 'senior-plan.raw.json'), 'utf8'));
    assert.equal(raw.selectedRiskResponses[0], 'guard-path-seed-schema-handoff');
    assert.match(raw.riskResponseEvidence, /path root isolation/u);

    const source = JSON.parse(readFileSync(join(workspace, 'handoff-source.json'), 'utf8'));
    assert.equal(source.experimentArm, 'r45-pl-risk-response-senior-plan-source');
    assert.deepEqual(source.modelOwnedFiles, ['senior-plan.risk-response.txt']);

    const verify = spawnSync(process.execPath, [VERIFY_SCRIPT, 'workspace/fscrud-01'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(verify.status, 0, verify.stderr);
  });
});

test('rejects correct ranking with missing risk response terms', () => {
  withWorkspace('1=guard\n2=expand\n3=manual', (root) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01', '--check-only'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /risk_response_terms_missing/);
  });
});

test('rejects wrong risk response order', () => {
  withWorkspace(VALID_RESPONSE.replace('1=guard-path-seed-schema-handoff', '1=manual'), (root) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01', '--check-only'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /risk_response_ranking_mismatch/);
  });
});

test('rejects empty risk response files', () => {
  withWorkspace('', (root) => {
    const result = spawnSync(process.execPath, [SCRIPT, 'workspace/fscrud-01', '--check-only'], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /risk_response_source_empty/);
  });
});

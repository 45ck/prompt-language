import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ORACLE = join(import.meta.dirname, 'gslr7-scaffolded-route-record-oracle.mjs');

function tempWorkspace() {
  const workspace = mkdtempSync(join(tmpdir(), 'gslr7-oracle-'));
  const src = join(workspace, 'src');
  spawnSync('mkdir', ['-p', src]);
  return { src, workspace };
}

test('GSLR-7 oracle rejects route records that omit helper exports', () => {
  const { src, workspace } = tempWorkspace();
  try {
    writeFileSync(
      join(src, 'route-decision-record.mjs'),
      'export function buildRouteDecisionRecord() { return { ok: true, errors: [], record: {} }; }\n',
    );

    const result = spawnSync(process.execPath, [ORACLE, '--workspace', workspace], {
      encoding: 'utf8',
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing exported helper boundary|missing .* export/i);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('GSLR-7 oracle rejects self-importing implementations', () => {
  const { src, workspace } = tempWorkspace();
  try {
    writeFileSync(
      join(src, 'route-decision-record.mjs'),
      [
        "import { buildRouteDecisionRecord } from './route-decision-record.mjs';",
        'export function normalizeRouteKey() {}',
        'export function isUnsafeEvidenceKey() {}',
        'export function containsUnsafeEvidenceText() {}',
        'export function isSafeEvidenceRef() {}',
        'export function deriveEscalationReasons() {}',
        'export function selectRouteDecision() {}',
      ].join('\n'),
    );

    const result = spawnSync(process.execPath, [ORACLE, '--workspace', workspace], {
      encoding: 'utf8',
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must not self-import/i);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('GSLR-7 oracle file exists for runner wiring', () => {
  assert.equal(existsSync(ORACLE), true);
});

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ORACLE = join(import.meta.dirname, 'gslr5-raw-payload-adversarial-oracle.mjs');

function tempWorkspace() {
  const workspace = mkdtempSync(join(tmpdir(), 'gslr5-oracle-'));
  const src = join(workspace, 'src');
  return { src, workspace };
}

test('GSLR-5 oracle rejects incomplete sanitizer', () => {
  const { src, workspace } = tempWorkspace();
  try {
    spawnSync('mkdir', ['-p', src]);
    writeFileSync(
      join(src, 'evidence-card-sanitizer.mjs'),
      'export function sanitizeEvidenceCardInput() { return { ok: true, errors: [], card: {} }; }\n',
    );

    const result = spawnSync(process.execPath, [ORACLE, '--workspace', workspace], {
      encoding: 'utf8',
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /action boundary|expected ok=false|unsupported|source payload/i);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('GSLR-5 oracle file exists for runner wiring', () => {
  assert.equal(existsSync(ORACLE), true);
});

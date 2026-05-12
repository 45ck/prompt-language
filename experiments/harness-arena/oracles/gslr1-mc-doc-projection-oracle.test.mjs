import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ORACLE = new URL('./gslr1-mc-doc-projection-oracle.mjs', import.meta.url).pathname;

function tempWorkspace() {
  const workspace = join(tmpdir(), `gslr1-oracle-${process.pid}-${Date.now()}`);
  mkdirSync(join(workspace, 'projection'), { recursive: true });
  return workspace;
}

function runOracle(workspace) {
  return spawnSync(process.execPath, [ORACLE, '--workspace', workspace], {
    encoding: 'utf8',
  });
}

function writeProjection(workspace, content) {
  writeFileSync(join(workspace, 'projection', 'portarium-evidence-envelope.md'), content, 'utf8');
}

const validProjection = `# Target Ref
GSLR-1 MC governed-Symphony evidence projection.

# Context Refs
- docs/architecture/mc-governed-symphony-reference-vertical.md
- docs/architecture/mc-gslr-1-projection-scenario.md

# Policy
Read-only and no-mutation. No source-system writes.

# Gates
Public gate, private oracle, and deterministic gate checks.

# Approvals
Human review and approval checkpoint before publishing.

# Evidence
hybrid-routing-manifest.json, gate result, final artifact, review verdict.

# Route
Local bounded bulk projection lane; frontier classification, repair, or review lane.

# Non-Goals
No source-system writes. No local-only autonomy claim.
`;

test('GSLR-1 private oracle passes a refs-only governed projection', () => {
  const workspace = tempWorkspace();
  try {
    writeProjection(workspace, validProjection);
    const result = runOracle(workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /gslr1 private oracle passed/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('GSLR-1 private oracle rejects hidden-oracle leakage', () => {
  const workspace = tempWorkspace();
  try {
    writeProjection(workspace, `${validProjection}\nThis mentions hidden oracle text.\n`);
    const result = runOracle(workspace);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /hidden-oracle leakage/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

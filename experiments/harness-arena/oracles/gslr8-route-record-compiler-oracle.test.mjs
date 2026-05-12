import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const ORACLE = join(import.meta.dirname, 'gslr8-route-record-compiler-oracle.mjs');

function workspaceWithFiles({ hooks }) {
  const workspace = mkdtempSync(join(tmpdir(), 'gslr8-oracle-'));
  const src = join(workspace, 'src');
  mkdirSync(src, { recursive: true });
  writeFileSync(
    join(src, 'route-decision-scaffold.mjs'),
    `
import { isRelativeArtifactReference, matchesAnyEvidenceTextPattern } from './route-predicate-hooks.mjs';
const UNSAFE_EVIDENCE_KEYS = new Set(['oraclecommand']);
const ESCALATION_REASON_ORDER = ['public-gate-failure'];
export function normalizeRouteKey(value) { return String(value).toLowerCase().replace(/[^a-z0-9]/g, ''); }
export function isUnsafeEvidenceKey(key) { return UNSAFE_EVIDENCE_KEYS.has(normalizeRouteKey(key)); }
export function containsUnsafeEvidenceText(value) { return matchesAnyEvidenceTextPattern(value, [/oracle command/i]); }
export function isSafeEvidenceRef(ref) { return isRelativeArtifactReference(ref); }
export function deriveEscalationReasons() { return ESCALATION_REASON_ORDER; }
export function selectRouteDecision() { return { decision: 'local-screen', reason: 'test frontier-baseline advisor-escalate' }; }
export function buildRouteDecisionRecord() { return { ok: true, errors: [], record: { selectedRoute: { decision: 'local-screen' } } }; }
`,
    'utf8',
  );
  writeFileSync(join(src, 'route-predicate-hooks.mjs'), hooks, 'utf8');
  return workspace;
}

test('GSLR-8 oracle rejects hooks that own route-policy constants', () => {
  const workspace = workspaceWithFiles({
    hooks: `
export function matchesAnyEvidenceTextPattern() { return false; }
export function isRelativeArtifactReference() { return 'frontier-baseline' !== ''; }
`,
  });
  try {
    const result = spawnSync(process.execPath, [ORACLE, '--workspace', workspace], {
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /hook file owns scaffold policy invariant/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('GSLR-8 oracle file exists for runner wiring', () => {
  const result = spawnSync(process.execPath, [ORACLE, '--workspace', '/definitely/missing'], {
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing src\/route-decision-scaffold\.mjs/);
});

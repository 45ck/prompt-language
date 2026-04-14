/**
 * Self-test for verify-trace.mjs.
 *
 * - Builds a valid 5-entry provenance.jsonl in a temp dir, asserts exit 0.
 * - Tampers entry 3 (flips a character in nodeId), asserts non-zero exit
 *   with a chain-break message.
 * - Deletes a shim_invocation_end, asserts non-zero exit with an orphan
 *   witness failure.
 *
 * Run: node scripts/eval/verify-trace.self-test.mjs
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { canonicalJSON, hashEvent } from './provenance-schema.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERIFIER = join(HERE, 'verify-trace.mjs');
const RUN_ID = 'run-self-test';

function buildEntry(seq, prevHash, overrides) {
  const base = {
    runId: RUN_ID,
    seq,
    timestamp: `2026-01-01T00:00:0${seq}.000Z`,
    pid: 4242,
    prevEventHash: prevHash,
    ...overrides,
  };
  base.eventHash = hashEvent(base);
  return base;
}

function buildValidChain() {
  // 5 entries: shim_begin, agent_begin, node_advance, agent_end, shim_end.
  const argv = ['-p', 'hello'];
  const stdinSha = 'a'.repeat(64);
  const e0 = buildEntry(0, null, {
    event: 'shim_invocation_begin',
    source: 'shim',
    argv,
    cwd: 'C:/tmp/x',
    stdinSha256: stdinSha,
    binaryPath: 'C:/bin/claude.exe',
    binarySha256: 'b'.repeat(64),
  });
  const e1 = buildEntry(1, e0.eventHash, {
    event: 'agent_invocation_begin',
    source: 'runtime',
    argv,
    stdinSha256: stdinSha,
    nodeId: 'n-root',
    nodeKind: 'prompt',
  });
  const e2 = buildEntry(2, e1.eventHash, {
    event: 'node_advance',
    source: 'runtime',
    nodeId: 'n-child-1',
    nodeKind: 'run',
    stateBeforeHash: 'c'.repeat(64),
    stateAfterHash: 'd'.repeat(64),
  });
  const e3 = buildEntry(3, e2.eventHash, {
    event: 'agent_invocation_end',
    source: 'runtime',
    argv,
    stdinSha256: stdinSha,
    stdoutSha256: 'e'.repeat(64),
    exitCode: 0,
    durationMs: 12,
  });
  const e4 = buildEntry(4, e3.eventHash, {
    event: 'shim_invocation_end',
    source: 'shim',
    argv,
    cwd: 'C:/tmp/x',
    stdinSha256: stdinSha,
    stdoutSha256: 'e'.repeat(64),
    binaryPath: 'C:/bin/claude.exe',
    binarySha256: 'b'.repeat(64),
    exitCode: 0,
    durationMs: 12,
  });
  return [e0, e1, e2, e3, e4];
}

function writeTrace(path, entries) {
  const text = entries.map((e) => canonicalJSON(e)).join('\n') + '\n';
  writeFileSync(path, text, 'utf8');
}

function runVerifier(tracePath) {
  return spawnSync(process.execPath, [VERIFIER, '--trace', tracePath], {
    encoding: 'utf8',
  });
}

function main() {
  const tmp = mkdtempSync(join(tmpdir(), 'pl-verify-selftest-'));
  const tracePath = join(tmp, 'provenance.jsonl');
  const entries = buildValidChain();

  // Case 1: valid chain -> exit 0.
  writeTrace(tracePath, entries);
  const r1 = runVerifier(tracePath);
  assert.equal(r1.status, 0, `expected exit 0, got ${r1.status}; stderr=${r1.stderr}`);
  assert.match(r1.stdout, /verify-trace OK/);
  console.log('[case 1] valid chain accepted');

  // Case 2: tamper entry 3 (flip a character in nodeId of entry 2 actually
  // — entry index 2 has nodeId). "Entry 3" in 1-based counting. We flip
  // the nodeId but leave its eventHash stale; that breaks chain detection.
  const tampered = entries.map((e) => ({ ...e }));
  tampered[2] = { ...tampered[2], nodeId: 'X-corrupted' };
  // Do NOT recompute eventHash — that's the tamper signature.
  writeTrace(tracePath, tampered);
  const r2 = runVerifier(tracePath);
  assert.notEqual(r2.status, 0, 'expected non-zero exit for tampered chain');
  assert.match(
    r2.stderr + r2.stdout,
    /chain:|eventHash/,
    `expected chain-break diagnostic, stdout=${r2.stdout} stderr=${r2.stderr}`,
  );
  console.log('[case 2] tampered entry rejected');

  // Case 3: drop the shim_invocation_end (last entry). Rebuild full chain
  // without it so seq + chain remain self-consistent; only the witness
  // pairing should fail.
  const withoutShimEnd = entries.slice(0, 4);
  writeTrace(tracePath, withoutShimEnd);
  const r3 = runVerifier(tracePath);
  assert.notEqual(r3.status, 0, 'expected non-zero exit for missing shim end');
  assert.match(
    r3.stderr + r3.stdout,
    /orphan|witness pairing/i,
    `expected orphan witness diagnostic, stdout=${r3.stdout} stderr=${r3.stderr}`,
  );
  console.log('[case 3] missing shim end detected as orphan');

  console.log('self-test OK');
}

main();

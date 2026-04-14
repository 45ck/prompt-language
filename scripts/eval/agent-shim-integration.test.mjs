/**
 * End-to-end integration tests for the pl-agent-shim + verify-trace loop.
 *
 * Witness loop being proven:
 *   1. Shim invocation writes begin/end records to provenance.jsonl.
 *   2. Verifier with shim-only records detects orphan-shim and FAILS.
 *   3. Verifier with injected matching runtime pair PASSES.
 *   4. Shim propagates non-zero exit from the real binary and still emits both records.
 *   5. stdin sha256 is computed correctly.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import {
  loadEntries,
  writeEntries,
  buildRuntimePair,
  rechainEntries,
} from './agent-shim-integration-helpers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHIM_PATH = resolve(HERE, 'agent-shim', 'pl-agent-shim.mjs');
const VERIFIER_PATH = resolve(HERE, 'verify-trace.mjs');
const NODE_EXE = process.execPath;

function makeTempDir(label) {
  return mkdtempSync(join(tmpdir(), `pl-shim-${label}-`));
}

function runShim({ cwd, traceDir, runId, realBin, realArgv = [], stdin = '', env = {} }) {
  const result = spawnSync(NODE_EXE, [SHIM_PATH, ...realArgv], {
    cwd,
    input: stdin,
    env: {
      ...process.env,
      PL_RUN_ID: runId,
      PL_TRACE_DIR: traceDir,
      PL_REAL_BIN: realBin,
      PL_SHIM_NAME: 'test-shim',
      ...env,
    },
    encoding: 'utf8',
  });
  return result;
}

function runVerifier(tracePath) {
  return spawnSync(NODE_EXE, [VERIFIER_PATH, '--trace', tracePath, '--json'], {
    encoding: 'utf8',
  });
}

function cleanup(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

test('shim invocation emits chained begin/end records with expected fields', () => {
  const cwd = makeTempDir('t1');
  try {
    const runId = 'run-test-1';
    const result = runShim({
      cwd,
      traceDir: '.prompt-language',
      runId,
      realBin: NODE_EXE,
      realArgv: ['-e', 'process.stdout.write("hello")'],
    });
    assert.equal(result.status, 0, `shim stderr: ${result.stderr}`);
    assert.equal(result.stdout, 'hello');

    const tracePath = join(cwd, '.prompt-language', 'provenance.jsonl');
    assert.ok(existsSync(tracePath), 'provenance.jsonl should exist');
    const entries = loadEntries(tracePath);
    assert.equal(entries.length, 2);
    const [begin, end] = entries;
    assert.equal(begin.event, 'shim_invocation_begin');
    assert.equal(begin.source, 'shim');
    assert.equal(begin.runId, runId);
    assert.equal(begin.seq, 0);
    assert.equal(begin.prevEventHash, null);
    assert.equal(typeof begin.eventHash, 'string');
    assert.equal(begin.eventHash.length, 64);
    assert.deepEqual(begin.argv, ['-e', 'process.stdout.write("hello")']);

    assert.equal(end.event, 'shim_invocation_end');
    assert.equal(end.source, 'shim');
    assert.equal(end.seq, 1);
    assert.equal(end.prevEventHash, begin.eventHash);
    assert.equal(end.exitCode, 0);
    const expectedStdoutSha = createHash('sha256').update('hello').digest('hex');
    assert.equal(end.stdoutSha256, expectedStdoutSha);
  } finally {
    cleanup(cwd);
  }
});

test('verifier FAILS with orphan-shim when only shim records exist', () => {
  const cwd = makeTempDir('t2');
  try {
    const runId = 'run-test-2';
    runShim({
      cwd,
      traceDir: '.prompt-language',
      runId,
      realBin: NODE_EXE,
      realArgv: ['-e', 'process.stdout.write("hello")'],
    });
    const tracePath = join(cwd, '.prompt-language', 'provenance.jsonl');
    const verify = runVerifier(tracePath);
    assert.notEqual(verify.status, 0, 'verifier should fail for orphan-shim');
    const parsed = JSON.parse(verify.stdout);
    assert.equal(parsed.ok, false);
    assert.ok(
      parsed.orphans.length >= 1,
      `expected orphans, got: ${JSON.stringify(parsed.orphans)}`,
    );
    const orphanLabels = parsed.orphans.map((o) => `${o.leftLabel}/${o.rightLabel}`);
    assert.ok(
      orphanLabels.some((l) => l.includes('shim_invocation')),
      `expected shim-orphan labels, got ${orphanLabels.join(',')}`,
    );
  } finally {
    cleanup(cwd);
  }
});

test('verifier PASSES when matching runtime pair is injected', () => {
  const cwd = makeTempDir('t3');
  try {
    const runId = 'run-test-3';
    runShim({
      cwd,
      traceDir: '.prompt-language',
      runId,
      realBin: NODE_EXE,
      realArgv: ['-e', 'process.stdout.write("hello")'],
    });
    const tracePath = join(cwd, '.prompt-language', 'provenance.jsonl');
    const shimEntries = loadEntries(tracePath);
    const [shimBegin, shimEnd] = shimEntries;
    const { runtimeBegin, runtimeEnd } = buildRuntimePair(shimBegin, shimEnd);
    // Prepend the runtime pair, then rechain everything deterministically.
    const rechained = rechainEntries([runtimeBegin, runtimeEnd, shimBegin, shimEnd]);
    writeEntries(tracePath, rechained);

    const verify = runVerifier(tracePath);
    assert.equal(
      verify.status,
      0,
      `verifier should pass. stdout=${verify.stdout} stderr=${verify.stderr}`,
    );
    const parsed = JSON.parse(verify.stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.entryCount, 4);
    assert.equal(parsed.runtimePairs, 1);
    assert.equal(parsed.runId, runId);
  } finally {
    cleanup(cwd);
  }
});

test('shim propagates non-zero exit code and still emits both records', () => {
  const cwd = makeTempDir('t4');
  try {
    const runId = 'run-test-4';
    const result = runShim({
      cwd,
      traceDir: '.prompt-language',
      runId,
      realBin: NODE_EXE,
      realArgv: ['-e', 'process.stdout.write("bye"); process.exit(7)'],
    });
    assert.equal(result.status, 7);
    const tracePath = join(cwd, '.prompt-language', 'provenance.jsonl');
    const entries = loadEntries(tracePath);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].event, 'shim_invocation_begin');
    assert.equal(entries[1].event, 'shim_invocation_end');
    assert.equal(entries[1].exitCode, 7);
  } finally {
    cleanup(cwd);
  }
});

test('shim computes stdinSha256 from forwarded stdin bytes', () => {
  const cwd = makeTempDir('t5');
  try {
    const runId = 'run-test-5';
    const stdin = 'witness payload\n';
    const expected = createHash('sha256').update(stdin).digest('hex');
    // Real bin consumes stdin so the pipe drains; its stdout can be empty.
    const result = runShim({
      cwd,
      traceDir: '.prompt-language',
      runId,
      realBin: NODE_EXE,
      realArgv: ['-e', 'process.stdin.resume(); process.stdin.on("data", () => {});'],
      stdin,
    });
    assert.equal(result.status, 0, `shim stderr: ${result.stderr}`);
    const tracePath = join(cwd, '.prompt-language', 'provenance.jsonl');
    const [begin, end] = loadEntries(tracePath);
    assert.equal(begin.stdinSha256, expected);
    assert.equal(end.stdinSha256, expected);
  } finally {
    cleanup(cwd);
  }
});

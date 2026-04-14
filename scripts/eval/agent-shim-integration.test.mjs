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
import {
  mkdtempSync,
  existsSync,
  rmSync,
  writeFileSync,
  readFileSync,
  statSync,
  utimesSync,
} from 'node:fs';
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
  // Hardening (AP-2): verify-trace requires --state or an explicit opt-out.
  // Integration tests here exercise shim-only flows without a session-state
  // file, so pass --allow-missing-state to keep the test surface focused on
  // shim/runtime pairing and chain integrity.
  return spawnSync(NODE_EXE, [VERIFIER_PATH, '--trace', tracePath, '--allow-missing-state', '--json'], {
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

// ---- AP-4: binary-hash cache hardening ----

const SHIM_DIR = resolve(HERE, 'agent-shim');
const BINARY_CACHE_PATH = join(SHIM_DIR, '.binary-cache.json');

function clearBinaryCache() {
  try {
    rmSync(BINARY_CACHE_PATH, { force: true });
  } catch {
    /* ignore */
  }
}

function readBinarySha(tracePath) {
  const [begin] = loadEntries(tracePath);
  return begin.binarySha256;
}

test('AP-4(A): default mode computes SHA-256 of PL_REAL_BIN each invocation', () => {
  const cwd = makeTempDir('ap4a');
  clearBinaryCache();
  try {
    const result = runShim({
      cwd,
      traceDir: '.prompt-language',
      runId: 'run-ap4-a',
      realBin: NODE_EXE,
      realArgv: ['-e', 'process.stdout.write("ok")'],
      env: { PL_SHIM_TRUST_CACHE: '' },
    });
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.ok(
      result.stderr.includes('binary-hash-mode: always-compute'),
      `expected always-compute tag, got: ${result.stderr}`,
    );

    const tracePath = join(cwd, '.prompt-language', 'provenance.jsonl');
    const sha = readBinarySha(tracePath);
    const expected = createHash('sha256').update(readFileSync(NODE_EXE)).digest('hex');
    assert.equal(sha, expected, 'binarySha256 must match freshly-computed hash of PL_REAL_BIN');

    // Default mode must not leave the cache file behind.
    assert.equal(
      existsSync(BINARY_CACHE_PATH),
      false,
      'default (always-compute) mode must not write .binary-cache.json',
    );
  } finally {
    cleanup(cwd);
    clearBinaryCache();
  }
});

test('AP-4(B): default mode detects mtime-preserve swap of the real binary', () => {
  const cwd = makeTempDir('ap4b');
  clearBinaryCache();
  try {
    // Use a per-test copy of node.exe as the "real binary" so we can swap it
    // on disk without affecting NODE_EXE used to host the shim itself.
    const launcher = join(cwd, 'real-bin.exe');
    writeFileSync(launcher, readFileSync(NODE_EXE));
    const st0 = statSync(launcher);

    const runOnce = (runId) =>
      runShim({
        cwd,
        traceDir: '.prompt-language',
        runId,
        realBin: launcher,
        realArgv: ['-e', 'process.stdout.write("ok")'],
        env: { PL_SHIM_TRUST_CACHE: '' },
      });

    const r1 = runOnce('run-ap4-b-1');
    assert.equal(r1.status, 0, `r1 stderr: ${r1.stderr}`);
    const tracePath = join(cwd, '.prompt-language', 'provenance.jsonl');
    const sha1 = readBinarySha(tracePath);

    // Swap bytes of the launcher and restore original mtime. Flip a trailing
    // overlay byte so the PE loader still accepts it.
    const flipped = Buffer.from(readFileSync(launcher));
    flipped[flipped.length - 1] = (flipped[flipped.length - 1] ^ 0x01) & 0xff;
    writeFileSync(launcher, flipped);
    utimesSync(launcher, st0.atime, st0.mtime);

    rmSync(tracePath, { force: true });

    const r2 = runOnce('run-ap4-b-2');
    assert.equal(r2.status, 0, `r2 stderr: ${r2.stderr}`);
    const sha2 = readBinarySha(tracePath);

    assert.notEqual(
      sha1,
      sha2,
      'default mode must rehash every invocation and detect the swap',
    );
  } finally {
    cleanup(cwd);
    clearBinaryCache();
  }
});

test('AP-4(C): PL_SHIM_TRUST_CACHE=1 returns stale hash after mtime-preserve swap (documents unsafe opt-in)', () => {
  const cwd = makeTempDir('ap4c');
  clearBinaryCache();
  try {
    const launcher = join(cwd, 'real-bin.exe');
    writeFileSync(launcher, readFileSync(NODE_EXE));
    // Pin the mtime to a fixed integer-second value so both runs key on an
    // identical mtimeMs regardless of filesystem timestamp precision.
    const pinnedMtimeSec = 1_700_000_000; // 2023-11-14
    utimesSync(launcher, pinnedMtimeSec, pinnedMtimeSec);

    const runOnce = (runId) =>
      runShim({
        cwd,
        traceDir: '.prompt-language',
        runId,
        realBin: launcher,
        realArgv: ['-e', 'process.stdout.write("ok")'],
        env: { PL_SHIM_TRUST_CACHE: '1' },
      });

    const r1 = runOnce('run-ap4-c-1');
    assert.equal(r1.status, 0, `r1 stderr: ${r1.stderr}`);
    assert.ok(
      r1.stderr.includes('binary-hash-mode: cached'),
      `expected cached mode tag, got: ${r1.stderr}`,
    );
    const tracePath = join(cwd, '.prompt-language', 'provenance.jsonl');
    const sha1 = readBinarySha(tracePath);

    const flipped = Buffer.from(readFileSync(launcher));
    flipped[flipped.length - 1] = (flipped[flipped.length - 1] ^ 0x01) & 0xff;
    writeFileSync(launcher, flipped);
    utimesSync(launcher, pinnedMtimeSec, pinnedMtimeSec);

    rmSync(tracePath, { force: true });
    const r2 = runOnce('run-ap4-c-2');
    assert.equal(r2.status, 0, `r2 stderr: ${r2.stderr}`);
    const sha2 = readBinarySha(tracePath);

    // The hallmark of the unsafe cached mode is that sha2 equals one of the
    // previously-cached values for this (path, mtimeMs) — not a fresh hash
    // of the swapped bytes. Assert sha2 is in the cache history.
    const freshHash = createHash('sha256').update(readFileSync(launcher)).digest('hex');
    assert.notEqual(
      sha2,
      freshHash,
      'cached mode must NOT reflect the swapped bytes (that would be the safe default)',
    );
    assert.equal(
      sha2,
      sha1,
      'cached mode must return the previously cached hash for (path, mtimeMs)',
    );
  } finally {
    cleanup(cwd);
    clearBinaryCache();
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

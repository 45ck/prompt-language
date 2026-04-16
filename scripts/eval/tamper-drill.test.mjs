/**
 * Tamper-drill integration test for verify-trace.mjs.
 *
 * Per META-3 (recursive verification): deliberately corrupt provenance.jsonl
 * and/or session-state.json in ways a forger might attempt, then assert the
 * verifier catches each specific tampering class. If the detector silently
 * regresses to accepting tampered input, these tests fail.
 *
 * Each case asserts BOTH (a) non-zero exit AND (b) a specific error-class
 * string in stdout/stderr so a generic "something broke" failure cannot mask
 * a weakened detector (a verifier that rejects everything for the wrong
 * reason is still wrong).
 *
 * Gaps: where the verifier currently does NOT catch a given class, the case
 * lands as test.skip with a bead issue id rather than being silently dropped
 * or patched around by weakening the verifier.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJSON, hashEvent, hashState } from './provenance-schema.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERIFIER = join(HERE, 'verify-trace.mjs');
const NODE_EXE = process.execPath;

// --- Builders ---------------------------------------------------------------

function buildEntry(runId, seq, prevHash, overrides) {
  const base = {
    runId,
    seq,
    timestamp: `2026-04-14T00:00:${String(seq).padStart(2, '0')}.000Z`,
    pid: 4242,
    prevEventHash: prevHash,
    ...overrides,
  };
  base.eventHash = hashEvent(base);
  return base;
}

/**
 * Build a valid 5-entry Merkle chain for `runId`:
 *   0 shim_invocation_begin
 *   1 agent_invocation_begin     <-- pairs with (0)
 *   2 node_advance  (carries stateAfterHash)
 *   3 agent_invocation_end       <-- pairs with (4)
 *   4 shim_invocation_end
 *
 * `stateAfterHash` at seq=2 matches `hashState(stateObj)`.
 */
function makeValidChain(runId, stateObj) {
  const argv = ['-p', 'hello'];
  const stdinSha = 'a'.repeat(64);
  const stateAfterHash = hashState(stateObj);
  const e0 = buildEntry(runId, 0, null, {
    event: 'shim_invocation_begin',
    source: 'shim',
    argv,
    cwd: 'C:/tmp/x',
    stdinSha256: stdinSha,
    binaryPath: 'C:/bin/claude.exe',
    binarySha256: 'b'.repeat(64),
  });
  const e1 = buildEntry(runId, 1, e0.eventHash, {
    event: 'agent_invocation_begin',
    source: 'runtime',
    argv,
    stdinSha256: stdinSha,
    nodeId: 'n-root',
    nodeKind: 'prompt',
  });
  const e2 = buildEntry(runId, 2, e1.eventHash, {
    event: 'node_advance',
    source: 'runtime',
    nodeId: 'n-child-1',
    nodeKind: 'run',
    stateBeforeHash: 'c'.repeat(64),
    stateAfterHash,
  });
  const e3 = buildEntry(runId, 3, e2.eventHash, {
    event: 'agent_invocation_end',
    source: 'runtime',
    argv,
    stdinSha256: stdinSha,
    stdoutSha256: 'e'.repeat(64),
    exitCode: 0,
    durationMs: 12,
  });
  const e4 = buildEntry(runId, 4, e3.eventHash, {
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
  writeFileSync(path, entries.map((e) => canonicalJSON(e)).join('\n') + '\n', 'utf8');
}

function writeState(path, state) {
  writeFileSync(path, JSON.stringify(state, null, 2), 'utf8');
}

function rebuildChain(entries) {
  const rebuilt = entries.map((entry, index) => {
    const next = { ...entry, seq: index, prevEventHash: index === 0 ? null : undefined };
    return next;
  });
  let prev = null;
  for (let i = 0; i < rebuilt.length; i += 1) {
    rebuilt[i].prevEventHash = prev;
    delete rebuilt[i].eventHash;
    rebuilt[i].eventHash = hashEvent(rebuilt[i]);
    prev = rebuilt[i].eventHash;
  }
  return rebuilt;
}

function withReviewerFamily(entries, reviewerFamily, index = 0) {
  const updated = entries.map((entry, entryIndex) => {
    if (entryIndex !== index) return { ...entry };
    return {
      ...entry,
      evidence: {
        ...(entry.evidence ?? {}),
        reviewer: {
          ...(entry.evidence?.reviewer ?? {}),
          family: reviewerFamily,
        },
      },
    };
  });
  return rebuildChain(updated);
}

function runVerifier(tracePath, extraArgs = []) {
  // Legacy entry point used by T1–T8. They exercise chain/witness semantics
  // that predate the AP-1/AP-2 --state mandate, so we default to
  // --allow-missing-state here. T9+ assert the new mandatory-flag paths
  // explicitly via a direct spawnSync that does NOT pre-supply the opt-out.
  return spawnSync(
    NODE_EXE,
    [VERIFIER, '--trace', tracePath, '--allow-missing-state', ...extraArgs],
    { encoding: 'utf8' },
  );
}

function freshFixture(label) {
  const dir = mkdtempSync(join(tmpdir(), `pl-tamper-${label}-`));
  const tracePath = join(dir, 'provenance.jsonl');
  const statePath = join(dir, 'session-state.json');
  const runId = `run-tamper-${label}`;
  const stateObj = {
    flow: { id: 'f1' },
    variables: { a: '1', b: '2' },
    cursor: { nodeId: 'n-child-1' },
  };
  const entries = makeValidChain(runId, stateObj);
  writeTrace(tracePath, entries);
  writeState(statePath, stateObj);
  return { dir, tracePath, statePath, runId, stateObj, entries };
}

function combinedOutput(r) {
  return `${r.stdout || ''}\n${r.stderr || ''}`;
}

// --- Sanity (fixture is valid) ---------------------------------------------

test('fixture: valid chain passes verifier (sanity)', () => {
  const f = freshFixture('sanity');
  const r = runVerifier(f.tracePath);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}; out=${combinedOutput(r)}`);
  assert.match(r.stdout, /verify-trace OK/);
});

test('fixture: valid chain + --state passes', () => {
  const f = freshFixture('sanity-state');
  const r = runVerifier(f.tracePath, ['--state', f.statePath]);
  assert.equal(
    r.status,
    0,
    `expected exit 0 with --state, got ${r.status}; out=${combinedOutput(r)}`,
  );
});

// --- T1: chain-break via reorder -------------------------------------------

test('T1 chain-break: swapping entries N=2 and N=3 is detected', () => {
  const f = freshFixture('T1');
  const tampered = [...f.entries];
  [tampered[1], tampered[2]] = [tampered[2], tampered[1]];
  writeTrace(f.tracePath, tampered);

  const r = runVerifier(f.tracePath);
  assert.notEqual(r.status, 0, 'expected non-zero exit after reorder');
  const out = combinedOutput(r);
  // Reorder breaks seq monotonicity first (detected before prevEventHash in verifyChain),
  // but either is an acceptable chain-break signal. The important thing is that a
  // chain-class diagnostic is present — not just a generic failure.
  assert.match(
    out,
    /chain:|seq \d+ expected|prevEventHash/,
    `expected chain-class diagnostic after reorder; out=${out}`,
  );
});

// --- T2: chain-break via field mutation ------------------------------------

test('T2 chain-break: mutating a field in entry N=2 without re-hashing is detected', () => {
  const f = freshFixture('T2');
  const tampered = f.entries.map((e) => ({ ...e }));
  // Mutate the nodeId in entry index 2 but leave its eventHash stale.
  tampered[2] = { ...tampered[2], nodeId: 'X-corrupted' };
  writeTrace(f.tracePath, tampered);

  const r = runVerifier(f.tracePath);
  assert.notEqual(r.status, 0, 'expected non-zero exit after field mutation');
  const out = combinedOutput(r);
  assert.match(
    out,
    /eventHash .* does not match recomputed|eventHash/,
    `expected eventHash-mismatch diagnostic; out=${out}`,
  );
});

// --- T3: chain-break via insertion -----------------------------------------

test('T3 chain-break: inserting a fabricated entry with stale successor prevEventHash is detected', () => {
  const f = freshFixture('T3');
  const tampered = f.entries.map((e) => ({ ...e }));
  // Fabricate a new entry between index 2 and 3. Give it a *valid* self-hash
  // (so the fabricated row alone looks well-formed), but DO NOT update the
  // following entry's prevEventHash — that's the chain-break signature.
  const fabricated = buildEntry(f.runId, 2, tampered[2].eventHash, {
    event: 'node_advance',
    source: 'runtime',
    nodeId: 'n-forged',
    nodeKind: 'prompt',
  });
  // Splice: [0,1,2, fabricated, 3(stale prevEventHash -> entries[2].eventHash), 4]
  const out = [tampered[0], tampered[1], tampered[2], fabricated, tampered[3], tampered[4]];
  // Re-number seq so only the chain-hash mismatch trips it, not seq.
  for (let i = 0; i < out.length; i += 1) {
    const e = out[i];
    if (e.seq !== i) {
      // Rebuild seq without recomputing hash so eventHash becomes stale only
      // on non-fabricated rows we touched. We only touch rows 3..5 (the ones
      // whose seq shifted). Fabricated already has seq=2.
      // To keep the tamper localized to "chain discontinuity", we rebuild
      // seq+hash on the rows *after* fabricated, but DELIBERATELY leave the
      // original entries[3].prevEventHash unchanged so it points to the old
      // entries[2].eventHash rather than the fabricated.eventHash.
      const stale = { ...e, seq: i };
      delete stale.eventHash;
      stale.eventHash = hashEvent(stale);
      out[i] = stale;
    }
  }
  writeTrace(f.tracePath, out);

  const r = runVerifier(f.tracePath);
  assert.notEqual(r.status, 0, 'expected non-zero exit after insertion');
  const combined = combinedOutput(r);
  assert.match(
    combined,
    /prevEventHash .* does not match|chain:/,
    `expected chain discontinuity diagnostic after insertion; out=${combined}`,
  );
});

// --- T4: missing witness ---------------------------------------------------

test('T4 missing-witness: deleting the shim_invocation_begin leaves the runtime begin orphaned', () => {
  const f = freshFixture('T4');
  // Drop entry 0 (shim_invocation_begin). Re-chain the rest so seq/prevHash
  // stay consistent — the ONLY failure should be witness pairing.
  const remaining = f.entries.slice(1).map((e) => ({ ...e }));
  let prev = null;
  for (let i = 0; i < remaining.length; i += 1) {
    remaining[i].seq = i;
    remaining[i].prevEventHash = prev;
    delete remaining[i].eventHash;
    remaining[i].eventHash = hashEvent(remaining[i]);
    prev = remaining[i].eventHash;
  }
  writeTrace(f.tracePath, remaining);

  const r = runVerifier(f.tracePath);
  assert.notEqual(r.status, 0, 'expected non-zero exit when shim begin is missing');
  const out = combinedOutput(r);
  assert.match(out, /orphan|witness pairing/i, `expected orphan/witness diagnostic; out=${out}`);
});

// --- T5: state-hash mismatch -----------------------------------------------

test('T5 state-hash-mismatch: mutating session-state.json is caught with --state', () => {
  const f = freshFixture('T5');
  // Mutate a byte in the state file.
  const mutated = { ...f.stateObj, variables: { ...f.stateObj.variables, a: 'TAMPERED' } };
  writeState(f.statePath, mutated);

  const r = runVerifier(f.tracePath, ['--state', f.statePath]);
  assert.notEqual(r.status, 0, 'expected non-zero exit for state mismatch');
  const out = combinedOutput(r);
  assert.match(out, /state hash mismatch/i, `expected state-hash-mismatch diagnostic; out=${out}`);
});

// --- T6: mixed runId -------------------------------------------------------

test('T6 mixed-runId: concatenating a second chain with a different runId is rejected', () => {
  const f = freshFixture('T6');
  // Build a second fully valid chain with a different runId, then
  // concatenate raw. The chain will fail on runId mismatch and/or seq reset.
  const other = makeValidChain('run-tamper-T6-OTHER', { different: true });
  const combined = [...f.entries, ...other];
  writeTrace(f.tracePath, combined);

  const r = runVerifier(f.tracePath);
  assert.notEqual(r.status, 0, 'expected non-zero exit for mixed runIds');
  const out = combinedOutput(r);
  assert.match(
    out,
    /multiple runIds|runId mismatch/i,
    `expected multi-runId diagnostic; out=${out}`,
  );
});

// --- T7: empty trace -------------------------------------------------------

test('T7 empty-trace: zero-byte provenance.jsonl is rejected', () => {
  const f = freshFixture('T7');
  writeFileSync(f.tracePath, '', 'utf8');

  const r = runVerifier(f.tracePath);
  assert.notEqual(r.status, 0, 'expected non-zero exit for empty trace');
  const out = combinedOutput(r);
  assert.match(out, /trace is empty/i, `expected empty-trace diagnostic; out=${out}`);
});

// --- T8: truncated last line -----------------------------------------------

test('T8 truncated-last-line: partial JSON on final line is rejected as invalid JSON', () => {
  const f = freshFixture('T8');
  // Append an unterminated JSON fragment.
  const good = readFileSync(f.tracePath, 'utf8');
  writeFileSync(f.tracePath, good + '{"runId":"run-tamper-T8","seq":5,"eve', 'utf8');

  const r = runVerifier(f.tracePath);
  // Current verifier behavior: loadTrace() JSON.parse throws on any non-empty
  // non-JSON line -> reported as "trace line N is not valid JSON".
  assert.notEqual(r.status, 0, 'expected non-zero exit for truncated last line');
  const out = combinedOutput(r);
  assert.match(out, /not valid JSON/i, `expected truncated-line JSON diagnostic; out=${out}`);
});

// ---------------------------------------------------------------------------
// Hardening patches (v2) — per docs/security/witness-chain-attacks.md. Each
// case asserts (a) non-zero exit AND (b) a specific error-class string so a
// regression that accepts the tampered input is caught even if some OTHER
// error fires for the wrong reason.
// ---------------------------------------------------------------------------

// --- T9: --state mandatory unless --allow-missing-state is explicit --------

test('T9 state-mandatory: omitting --state without --allow-missing-state is rejected', () => {
  const f = freshFixture('T9');
  // Deliberately DO NOT pass --allow-missing-state or --state.
  const r = spawnSync(NODE_EXE, [VERIFIER, '--trace', f.tracePath], { encoding: 'utf8' });
  assert.notEqual(r.status, 0, 'expected non-zero exit when --state is omitted');
  const out = combinedOutput(r);
  assert.match(
    out,
    /--state is required|allow-missing-state/i,
    `expected --state-required diagnostic; out=${out}`,
  );
});

// --- T10: mismatched --expected-run-id -------------------------------------

test('T10 expected-run-id: mismatched nonce is rejected', () => {
  const f = freshFixture('T10');
  const r = runVerifier(f.tracePath, ['--expected-run-id', 'run-not-the-one']);
  assert.notEqual(r.status, 0, 'expected non-zero exit for runId mismatch');
  const out = combinedOutput(r);
  assert.match(
    out,
    /expected-runId-mismatch/i,
    `expected expected-runId-mismatch diagnostic; out=${out}`,
  );
});

// --- T11: stale timestamp outside --freshness-window-ms --------------------

test('T11 freshness-window: stale first-entry timestamp is rejected', () => {
  const f = freshFixture('T11');
  // Rewrite the trace with an intentionally stale timestamp on entry 0.
  // Use a fixed well-in-the-past instant; window of 1000 ms must catch it.
  const stale = f.entries.map((e) => ({ ...e }));
  stale[0] = { ...stale[0], timestamp: '2020-01-01T00:00:00.000Z' };
  delete stale[0].eventHash;
  stale[0].eventHash = hashEvent(stale[0]);
  let prev = stale[0].eventHash;
  for (let i = 1; i < stale.length; i += 1) {
    stale[i] = { ...stale[i], prevEventHash: prev };
    delete stale[i].eventHash;
    stale[i].eventHash = hashEvent(stale[i]);
    prev = stale[i].eventHash;
  }
  writeTrace(f.tracePath, stale);
  const r = runVerifier(f.tracePath, ['--freshness-window-ms', '1000']);
  assert.notEqual(r.status, 0, 'expected non-zero exit for stale timestamp');
  const out = combinedOutput(r);
  assert.match(
    out,
    /freshness-window-exceeded/i,
    `expected freshness-window-exceeded diagnostic; out=${out}`,
  );
});

// --- T12: --expected-pair-count mismatch -----------------------------------

test('T12 expected-pair-count: mismatch is rejected', () => {
  const f = freshFixture('T12');
  // Fixture has exactly one runtime/shim pair; assert "2" expected.
  const r = runVerifier(f.tracePath, ['--expected-pair-count', '2']);
  assert.notEqual(r.status, 0, 'expected non-zero exit for pair-count mismatch');
  const out = combinedOutput(r);
  assert.match(
    out,
    /expected-pair-count-mismatch/i,
    `expected expected-pair-count-mismatch diagnostic; out=${out}`,
  );
});

// --- T13: --min-entries higher than actual ---------------------------------

test('T13 min-entries: too-few entries is rejected', () => {
  const f = freshFixture('T13');
  // Fixture has 5 entries; demand at least 100.
  const r = runVerifier(f.tracePath, ['--min-entries', '100']);
  assert.notEqual(r.status, 0, 'expected non-zero exit for min-entries');
  const out = combinedOutput(r);
  assert.match(out, /min-entries-not-met/i, `expected min-entries-not-met diagnostic; out=${out}`);
});

// --- T14: binary hash not in allow-list ------------------------------------

test('T14 binary-hash-allow-list: unknown hash is rejected', () => {
  const f = freshFixture('T14');
  // The fixture's shim binarySha256 is 'b'.repeat(64). Ship an allow-list
  // whose "claude" key does NOT include that value.
  const allowListPath = join(f.dir, 'allow-list.json');
  writeFileSync(allowListPath, JSON.stringify({ claude: ['0'.repeat(64)] }, null, 2), 'utf8');
  const r = runVerifier(f.tracePath, ['--expected-binary-hashes', allowListPath]);
  assert.notEqual(r.status, 0, 'expected non-zero exit for disallowed binary hash');
  const out = combinedOutput(r);
  assert.match(
    out,
    /binary-hash-not-allowed/i,
    `expected binary-hash-not-allowed diagnostic; out=${out}`,
  );
});

// --- T15: regression guard — valid fixture + all new flags passes ----------

test('T15 regression-guard: valid chain passes with all new flags correctly set', () => {
  const f = freshFixture('T15');
  // Build an allow-list that DOES contain the fixture's binarySha256.
  const allowListPath = join(f.dir, 'allow-list.json');
  writeFileSync(allowListPath, JSON.stringify({ claude: ['b'.repeat(64)] }, null, 2), 'utf8');
  // freshness-window wide enough to include 2026-04-14 timestamps regardless
  // of slight harness clock drift — 400 days in ms.
  const wideWindow = String(400 * 24 * 60 * 60 * 1000);
  const r = spawnSync(
    NODE_EXE,
    [
      VERIFIER,
      '--trace',
      f.tracePath,
      '--state',
      f.statePath,
      '--expected-run-id',
      f.runId,
      '--freshness-window-ms',
      wideWindow,
      '--expected-pair-count',
      '1',
      '--min-entries',
      '1',
      '--expected-binary-hashes',
      allowListPath,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(
    r.status,
    0,
    `expected exit 0 with all hardening flags; stdout=${r.stdout} stderr=${r.stderr}`,
  );
  assert.match(r.stdout, /verify-trace OK/);
  // State check was NOT skipped here.
  assert.doesNotMatch(r.stdout, /state-check-skipped/);
});

// --- T16: --allow-missing-state emits the state-check-skipped annotation ---

test('T16 allow-missing-state: OK line carries (state-check-skipped) annotation', () => {
  const f = freshFixture('T16');
  const r = spawnSync(NODE_EXE, [VERIFIER, '--trace', f.tracePath, '--allow-missing-state'], {
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, `expected exit 0; out=${combinedOutput(r)}`);
  assert.match(r.stdout, /verify-trace OK/);
  assert.match(
    r.stdout,
    /state-check-skipped/,
    `expected (state-check-skipped) annotation; stdout=${r.stdout}`,
  );
});

test('T17 expected-reviewer-family: matching reviewer.family evidence passes', () => {
  const f = freshFixture('T17');
  writeTrace(f.tracePath, withReviewerFamily(f.entries, 'openai'));

  const r = runVerifier(f.tracePath, ['--expected-reviewer-family', 'openai']);
  assert.equal(
    r.status,
    0,
    `expected exit 0 for matching reviewer family; out=${combinedOutput(r)}`,
  );
  assert.match(r.stdout, /verify-trace OK/);
});

test('T18 expected-reviewer-family: missing reviewer.family evidence is rejected', () => {
  const f = freshFixture('T18');

  const r = runVerifier(f.tracePath, ['--expected-reviewer-family', 'openai']);
  assert.notEqual(r.status, 0, 'expected non-zero exit for missing reviewer family evidence');
  const out = combinedOutput(r);
  assert.match(
    out,
    /expected-reviewer-family-missing/i,
    `expected reviewer-family-missing diagnostic; out=${out}`,
  );
});

test('T19 expected-reviewer-family: mismatched reviewer.family evidence is rejected', () => {
  const f = freshFixture('T19');
  writeTrace(f.tracePath, withReviewerFamily(f.entries, 'anthropic'));

  const r = runVerifier(f.tracePath, ['--expected-reviewer-family', 'openai']);
  assert.notEqual(r.status, 0, 'expected non-zero exit for reviewer family mismatch');
  const out = combinedOutput(r);
  assert.match(
    out,
    /expected-reviewer-family-mismatch/i,
    `expected reviewer-family-mismatch diagnostic; out=${out}`,
  );
});

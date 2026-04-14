/**
 * Helpers for the agent-shim integration test suite.
 *
 * These utilities read the shim-produced provenance.jsonl and synthesize
 * matching runtime `agent_invocation_*` records so the verifier's pairing
 * check passes.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { hashEvent, canonicalJSON } from './provenance-schema.mjs';

export function loadEntries(tracePath) {
  const raw = readFileSync(tracePath, 'utf8');
  return raw
    .split(/\r?\n/)
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
}

export function writeEntries(tracePath, entries) {
  const body = entries.map((e) => canonicalJSON(e)).join('\n') + '\n';
  writeFileSync(tracePath, body, 'utf8');
}

/**
 * Given shim begin/end entries, build runtime begin/end entries that will
 * pair with them (same pid, argv, stdinSha256). The returned pair is NOT
 * yet chained — callers pass them to `prependRuntimePair` for insertion.
 */
export function buildRuntimePair(shimBegin, shimEnd) {
  const runtimeBegin = {
    runId: shimBegin.runId,
    seq: 0,
    timestamp: shimBegin.timestamp,
    event: 'agent_invocation_begin',
    source: 'runtime',
    pid: shimBegin.pid,
    argv: shimBegin.argv,
    cwd: shimBegin.cwd,
    stdinSha256: shimBegin.stdinSha256,
    prevEventHash: null,
  };
  const runtimeEnd = {
    runId: shimEnd.runId,
    seq: 1,
    timestamp: shimEnd.timestamp,
    event: 'agent_invocation_end',
    source: 'runtime',
    pid: shimEnd.pid,
    argv: shimEnd.argv,
    cwd: shimEnd.cwd,
    stdinSha256: shimEnd.stdinSha256,
    stdoutSha256: shimEnd.stdoutSha256,
    exitCode: shimEnd.exitCode,
    prevEventHash: null, // set in prependRuntimePair
  };
  return { runtimeBegin, runtimeEnd };
}

/**
 * Re-chain an entire list of entries: recompute seq (starting at 0),
 * prevEventHash, and eventHash for each entry in order.
 */
export function rechainEntries(entries) {
  let prevHash = null;
  const out = [];
  for (let i = 0; i < entries.length; i += 1) {
    const e = { ...entries[i] };
    e.seq = i;
    e.prevEventHash = prevHash;
    delete e.eventHash;
    e.eventHash = hashEvent(e);
    prevHash = e.eventHash;
    out.push(e);
  }
  return out;
}

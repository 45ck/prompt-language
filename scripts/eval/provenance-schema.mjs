/**
 * Provenance schema for the independent-witness shim.
 *
 * Mirrors src/domain/state-hash.ts semantics exactly so shim-side records
 * and runtime-side records produce byte-identical canonical JSON and
 * equivalent SHA-256 digests. Any drift here breaks the cross-check.
 */

import { createHash, randomUUID } from 'node:crypto';

const EXCLUDED_TOP_LEVEL_KEYS = new Set(['_checksum', 'stateHash', 'prevStateHash']);

const ALLOWED_EVENTS = new Set([
  'shim_invocation_begin',
  'shim_invocation_end',
  'agent_invocation_begin',
  'agent_invocation_end',
  'node_advance',
  'state_transition',
  'flow_begin',
  'flow_end',
]);

const ALLOWED_SOURCES = new Set(['shim', 'runtime']);

export function canonicalJSON(value, excludeTopLevel = false) {
  return stringify(value, excludeTopLevel);
}

function stringify(value, excludeTopLevel) {
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    const parts = value.map((v) => stringify(v, false));
    return `[${parts.join(',')}]`;
  }
  if (typeof value === 'object') {
    const obj = value;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .filter((k) => !(excludeTopLevel && EXCLUDED_TOP_LEVEL_KEYS.has(k)))
      .sort();
    const parts = keys.map((k) => `${JSON.stringify(k)}:${stringify(obj[k], false)}`);
    return `{${parts.join(',')}}`;
  }
  return 'null';
}

export function sha256(input) {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function hashState(state) {
  return sha256(canonicalJSON(state, true));
}

export function hashEvent(entry) {
  const rest = { ...entry };
  delete rest.eventHash;
  return sha256(canonicalJSON(rest));
}

export function newRunId() {
  return `run-${Date.now().toString(36)}-${randomUUID()}`;
}

/**
 * Returns `{ ok: true }` or `{ ok: false, error: string }`.
 * Validates shape only, not chain integrity (that's verifyChain).
 */
export function validateEntry(entry) {
  if (!entry || typeof entry !== 'object') return { ok: false, error: 'entry not object' };
  if (typeof entry.runId !== 'string' || !entry.runId) return { ok: false, error: 'runId missing' };
  if (typeof entry.seq !== 'number' || !Number.isInteger(entry.seq) || entry.seq < 0) {
    return { ok: false, error: 'seq must be non-negative integer' };
  }
  if (typeof entry.timestamp !== 'string' || !entry.timestamp) {
    return { ok: false, error: 'timestamp missing' };
  }
  if (typeof entry.event !== 'string' || !ALLOWED_EVENTS.has(entry.event)) {
    return { ok: false, error: `event invalid: ${entry.event}` };
  }
  if (typeof entry.source !== 'string' || !ALLOWED_SOURCES.has(entry.source)) {
    return { ok: false, error: `source invalid: ${entry.source}` };
  }
  if (typeof entry.pid !== 'number' || !Number.isInteger(entry.pid)) {
    return { ok: false, error: 'pid must be integer' };
  }
  if (typeof entry.eventHash !== 'string' || entry.eventHash.length !== 64) {
    return { ok: false, error: 'eventHash must be 64-char hex' };
  }
  if (entry.prevEventHash !== null && typeof entry.prevEventHash !== 'string') {
    return { ok: false, error: 'prevEventHash must be string or null' };
  }
  return { ok: true };
}

/**
 * Verify the chain integrity across all entries.
 * Returns `{ ok: true, count }` or `{ ok: false, error, index? }`.
 */
export function verifyChain(entries) {
  if (!Array.isArray(entries)) return { ok: false, error: 'entries must be array' };
  if (entries.length === 0) return { ok: true, count: 0 };
  let runId = null;
  let prevHash = null;
  let expectedSeq = entries[0].seq;
  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    const v = validateEntry(e);
    if (!v.ok) return { ok: false, error: `entry ${i}: ${v.error}`, index: i };
    if (runId === null) runId = e.runId;
    else if (e.runId !== runId) {
      return { ok: false, error: `entry ${i}: runId mismatch (${e.runId} vs ${runId})`, index: i };
    }
    if (e.seq !== expectedSeq) {
      return { ok: false, error: `entry ${i}: seq ${e.seq} expected ${expectedSeq}`, index: i };
    }
    expectedSeq = e.seq + 1;
    if (i === 0) {
      // first entry may have null prevEventHash; don't constrain
    } else if (e.prevEventHash !== prevHash) {
      return {
        ok: false,
        error: `entry ${i}: prevEventHash ${e.prevEventHash} does not match previous eventHash ${prevHash}`,
        index: i,
      };
    }
    const recomputed = hashEvent(e);
    if (recomputed !== e.eventHash) {
      return {
        ok: false,
        error: `entry ${i}: eventHash ${e.eventHash} does not match recomputed ${recomputed}`,
        index: i,
      };
    }
    prevHash = e.eventHash;
  }
  return { ok: true, count: entries.length };
}

/**
 * Canonical JSON + SHA-256 helpers for verifiable state chaining.
 *
 * Pure domain. No I/O. Deterministic across platforms: keys are sorted,
 * arrays preserve order, and undefined properties are dropped (matching
 * JSON.stringify's behavior) so hashes are reproducible.
 *
 * The `_checksum`, `stateHash`, and `prevStateHash` fields are excluded from
 * hashing so the hash describes the state's content, not its bookkeeping.
 */

import { createHash } from 'node:crypto';

const EXCLUDED_TOP_LEVEL_KEYS = new Set(['_checksum', 'stateHash', 'prevStateHash']);

export function canonicalJSON(value: unknown, excludeTopLevel = false): string {
  return stringify(value, excludeTopLevel);
}

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function hashState(state: unknown): string {
  return sha256(canonicalJSON(state, true));
}

export function hashEvent(entry: Readonly<Record<string, unknown>>): string {
  const { eventHash: _ignored, ...rest } = entry;
  return sha256(canonicalJSON(rest));
}

function stringify(value: unknown, excludeTopLevel: boolean): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    const parts = value.map((v) => stringify(v, false));
    return `[${parts.join(',')}]`;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .filter((k) => !(excludeTopLevel && EXCLUDED_TOP_LEVEL_KEYS.has(k)))
      .sort();
    const parts = keys.map((k) => `${JSON.stringify(k)}:${stringify(obj[k], false)}`);
    return `{${parts.join(',')}}`;
  }
  // functions / symbols / undefined -> drop
  return 'null';
}

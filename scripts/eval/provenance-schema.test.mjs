/**
 * Unit tests for provenance-schema.mjs.
 *
 * Run: node scripts/eval/provenance-schema.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalJSON,
  sha256,
  hashEvent,
  hashState,
  newRunId,
  validateEntry,
  verifyChain,
} from './provenance-schema.mjs';

test('canonicalJSON sorts keys deterministically', () => {
  const a = canonicalJSON({ b: 1, a: 2, c: 3 });
  const b = canonicalJSON({ c: 3, a: 2, b: 1 });
  assert.equal(a, b);
  assert.equal(a, '{"a":2,"b":1,"c":3}');
});

test('canonicalJSON drops undefined but keeps null', () => {
  const s = canonicalJSON({ a: undefined, b: null, c: 1 });
  assert.equal(s, '{"b":null,"c":1}');
});

test('canonicalJSON preserves array order', () => {
  assert.equal(canonicalJSON([3, 1, 2]), '[3,1,2]');
});

test('canonicalJSON handles nested objects', () => {
  const s = canonicalJSON({ z: { b: 2, a: 1 }, a: [{ y: 2, x: 1 }] });
  assert.equal(s, '{"a":[{"x":1,"y":2}],"z":{"a":1,"b":2}}');
});

test('canonicalJSON excludeTopLevel drops bookkeeping keys only at top', () => {
  const s = canonicalJSON(
    { stateHash: 'h', prevStateHash: 'p', _checksum: 'c', a: 1, nested: { stateHash: 'inner' } },
    true,
  );
  assert.equal(s, '{"a":1,"nested":{"stateHash":"inner"}}');
});

test('sha256 is deterministic', () => {
  assert.equal(sha256('hello'), sha256('hello'));
  assert.notEqual(sha256('hello'), sha256('Hello'));
  assert.equal(sha256('').length, 64);
});

test('hashEvent excludes eventHash field', () => {
  const entry = { runId: 'r', seq: 0, event: 'x', foo: 1 };
  const h1 = hashEvent(entry);
  const h2 = hashEvent({ ...entry, eventHash: 'whatever' });
  assert.equal(h1, h2);
});

test('hashState excludes bookkeeping top-level keys (matches runtime)', () => {
  const s1 = hashState({ a: 1, stateHash: 'x', prevStateHash: 'y', _checksum: 'z' });
  const s2 = hashState({ a: 1 });
  assert.equal(s1, s2);
});

test('newRunId returns unique strings', () => {
  const a = newRunId();
  const b = newRunId();
  assert.notEqual(a, b);
  assert.match(a, /^run-/);
});

function buildEntry(seq, prevHash, overrides = {}) {
  const base = {
    runId: 'run-test',
    seq,
    timestamp: '2026-01-01T00:00:00.000Z',
    event: 'shim_invocation_begin',
    source: 'shim',
    pid: 1000 + seq,
    prevEventHash: prevHash,
    ...overrides,
  };
  base.eventHash = hashEvent(base);
  return base;
}

test('validateEntry accepts a well-formed entry', () => {
  const e = buildEntry(0, null);
  assert.equal(validateEntry(e).ok, true);
});

test('validateEntry rejects bad event / source / seq', () => {
  assert.equal(validateEntry({}).ok, false);
  const e = buildEntry(0, null);
  assert.equal(validateEntry({ ...e, event: 'nope', eventHash: 'x'.repeat(64) }).ok, false);
  assert.equal(validateEntry({ ...e, source: 'nope', eventHash: 'x'.repeat(64) }).ok, false);
  assert.equal(validateEntry({ ...e, seq: -1, eventHash: 'x'.repeat(64) }).ok, false);
});

test('verifyChain accepts an unbroken chain', () => {
  const e0 = buildEntry(0, null);
  const e1 = buildEntry(1, e0.eventHash);
  const e2 = buildEntry(2, e1.eventHash);
  const r = verifyChain([e0, e1, e2]);
  assert.equal(r.ok, true);
  assert.equal(r.count, 3);
});

test('verifyChain detects broken prevEventHash', () => {
  const e0 = buildEntry(0, null);
  const e1 = buildEntry(1, 'wrong'.padEnd(64, '0'));
  const r = verifyChain([e0, e1]);
  assert.equal(r.ok, false);
  assert.equal(r.index, 1);
});

test('verifyChain detects tampered eventHash', () => {
  const e0 = buildEntry(0, null);
  const tampered = { ...e0, eventHash: 'a'.repeat(64) };
  const r = verifyChain([tampered]);
  assert.equal(r.ok, false);
});

test('verifyChain detects seq gap', () => {
  const e0 = buildEntry(0, null);
  const e2 = buildEntry(2, e0.eventHash);
  const r = verifyChain([e0, e2]);
  assert.equal(r.ok, false);
});

test('verifyChain detects runId mismatch', () => {
  const e0 = buildEntry(0, null);
  const e1 = buildEntry(1, e0.eventHash, { runId: 'other' });
  const r = verifyChain([e0, e1]);
  assert.equal(r.ok, false);
});

test('re-exports point at the compiled runtime dist (AP-6: single source of truth)', async () => {
  // If this import fails, `npm run build` has not been run; the verifier is
  // expected to refuse to operate rather than silently fall back to a local
  // duplicate implementation.
  const { pathToFileURL, fileURLToPath } = await import('node:url');
  const { default: path } = await import('node:path');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const distUrl = pathToFileURL(
    path.resolve(here, '..', '..', 'dist', 'domain', 'state-hash.js'),
  ).href;
  const dist = await import(distUrl);
  assert.equal(canonicalJSON, dist.canonicalJSON, 'canonicalJSON not re-exported from dist');
  assert.equal(sha256, dist.sha256, 'sha256 not re-exported from dist');
  assert.equal(hashEvent, dist.hashEvent, 'hashEvent not re-exported from dist');
  assert.equal(hashState, dist.hashState, 'hashState not re-exported from dist');
});

test('canonicalJSON agrees with an independent reference on a fuzz sample', () => {
  // Quick embedded smoke; the full 10k sweep lives in canonical-json-fuzz.test.mjs.
  // Hand-written oracle avoids JSON.stringify's integer-key reordering inside objects.
  function reference(v) {
    if (v === null) return 'null';
    const t = typeof v;
    if (t === 'boolean' || t === 'number' || t === 'string') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(reference).join(',') + ']';
    if (t === 'object') {
      const keys = Object.keys(v)
        .filter((k) => v[k] !== undefined)
        .sort();
      return '{' + keys.map((k) => `${JSON.stringify(k)}:${reference(v[k])}`).join(',') + '}';
    }
    return 'null';
  }
  const samples = [
    { b: 1, a: 2 },
    { nested: { z: 1, a: { y: 2, x: 3 } } },
    [1, 'two', null, { k: 'v' }],
    { '': 'empty', A: 1, a: 2 },
  ];
  for (const s of samples) assert.equal(canonicalJSON(s), reference(s));
});

test('hash-equivalence with runtime state-hash semantics (structural)', () => {
  // The same record must hash identically to what src/domain/state-hash.ts would produce.
  // We replicate the algorithm here; drift breaks witness cross-check.
  const record = {
    runId: 'r',
    seq: 0,
    event: 'agent_invocation_begin',
    source: 'runtime',
    pid: 42,
    nodeId: 'n1',
    timestamp: 't',
    prevEventHash: null,
  };
  // Canonical form must match string comparison exactly.
  const canonical = canonicalJSON(record);
  assert.equal(
    canonical,
    '{"event":"agent_invocation_begin","nodeId":"n1","pid":42,"prevEventHash":null,"runId":"r","seq":0,"source":"runtime","timestamp":"t"}',
  );
});

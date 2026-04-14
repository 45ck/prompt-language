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

/**
 * Fuzz-contract test for canonicalJSON (AP-6).
 *
 * Now that scripts/eval/provenance-schema.mjs re-exports from
 * dist/domain/state-hash.js, the runtime and verifier share one impl.
 * This test locks that impl against an independent reference — JSON.stringify
 * with a key-sorting replacer — across 10,000 randomly generated values.
 *
 * Run: node --test scripts/eval/canonical-json-fuzz.test.mjs
 * Requires: npm run build (so dist/domain/state-hash.js exists).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJSON } from './provenance-schema.mjs';

// --- Reference implementation ----------------------------------------------
// Independent oracle: a hand-written recursive stringifier. Uses JSON.stringify
// only for leaf primitives (strings/numbers/booleans/null) so key emission is
// not reordered by V8's integer-like-string optimization inside object keys.
// If this diverges from canonicalJSON for any random input, one of the two
// has a bug — AP-6 drift.
function referenceCanonical(value) {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'boolean' || t === 'number' || t === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(referenceCanonical).join(',') + ']';
  }
  if (t === 'object') {
    const keys = Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort();
    const parts = keys.map((k) => `${JSON.stringify(k)}:${referenceCanonical(value[k])}`);
    return '{' + parts.join(',') + '}';
  }
  return 'null';
}

// --- Value generator -------------------------------------------------------
function rng(seed) {
  // Mulberry32: deterministic PRNG so failures reproduce.
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UNICODE_SAMPLES = [
  '',
  'plain',
  'he said "hi"',
  'back\\slash',
  'new\nline',
  'tab\there',
  'control\u0001\u0002\u001f',
  'unicode: \u00e9\u00e0\u4e2d\u6587',
  'emoji: \u{1F600}\u{1F4A9}',
  'quote\'apostrophe',
  'slash/forward',
  '\u2028 line sep \u2029',
];

const NUMERIC_KEYS = ['1', '2', '10', '0', '-1'];
const CASE_KEYS = ['A', 'a', 'B', 'b', 'Z', 'z'];
const REGULAR_KEYS = ['id', 'name', 'value', 'nested', 'items', ''];

function makeValue(rand, depth) {
  const roll = rand();
  if (depth <= 0 || roll < 0.15) return makeScalar(rand);
  if (roll < 0.5) return makeObject(rand, depth);
  if (roll < 0.85) return makeArray(rand, depth);
  return makeScalar(rand);
}

function makeScalar(rand) {
  const pick = Math.floor(rand() * 7);
  switch (pick) {
    case 0:
      return null;
    case 1:
      return rand() < 0.5;
    case 2:
      return Math.floor((rand() - 0.5) * 2_000_000);
    case 3:
      return (rand() - 0.5) * 1e6;
    case 4:
      return UNICODE_SAMPLES[Math.floor(rand() * UNICODE_SAMPLES.length)];
    case 5:
      // Deliberately include 0 and -0 occasionally.
      return rand() < 0.5 ? 0 : -0;
    default:
      return Math.floor(rand() * 100);
  }
}

function chooseKeyPool(rand) {
  const r = rand();
  if (r < 0.15) return NUMERIC_KEYS;
  if (r < 0.3) return CASE_KEYS;
  return REGULAR_KEYS;
}

function makeObject(rand, depth) {
  const size = Math.floor(rand() * 6); // 0..5 keys
  const pool = chooseKeyPool(rand);
  const obj = {};
  for (let i = 0; i < size; i += 1) {
    const k = pool[Math.floor(rand() * pool.length)];
    obj[k] = makeValue(rand, depth - 1);
    // Occasionally inject an explicit undefined (must be dropped identically).
    if (rand() < 0.05) obj[`u_${i}`] = undefined;
  }
  return obj;
}

function makeArray(rand, depth) {
  const size = Math.floor(rand() * 5); // 0..4 elements
  const arr = [];
  for (let i = 0; i < size; i += 1) arr.push(makeValue(rand, depth - 1));
  return arr;
}

// --- Tests -----------------------------------------------------------------

test('canonicalJSON matches sorted-key JSON.stringify for 10k random values', () => {
  const rand = rng(0xc0ffee);
  const N = 10_000;
  let checked = 0;
  for (let i = 0; i < N; i += 1) {
    const v = makeValue(rand, 8);
    const ours = canonicalJSON(v);
    const ref = referenceCanonical(v);
    assert.equal(
      ours,
      ref,
      `divergence at iteration ${i}\nvalue=${JSON.stringify(v)}\nours=${ours}\nref=${ref}`,
    );
    checked += 1;
  }
  assert.equal(checked, N);
});

test('canonicalJSON handles hand-picked edge cases identically to reference', () => {
  const cases = [
    {},
    [],
    { '': 1 },
    { a: 0, b: -0 },
    { A: 1, a: 2 },
    { 2: 'two', 10: 'ten', 1: 'one' },
    { s: 'he said "hi"\nnext' },
    { n: null, u: undefined, z: 0 },
    [[], [[]], [[[]]]],
    { a: { b: { c: { d: { e: 1 } } } } },
  ];
  for (const c of cases) {
    assert.equal(canonicalJSON(c), referenceCanonical(c), `case ${JSON.stringify(c)}`);
  }
});

test('canonicalJSON is deterministic under key-reordering (10k randomized pairs)', () => {
  const rand = rng(0xbeef);
  for (let i = 0; i < 10_000; i += 1) {
    const v = makeObject(rand, 6);
    const keys = Object.keys(v);
    const shuffled = {};
    // Reverse-insert to force a different insertion order.
    for (let j = keys.length - 1; j >= 0; j -= 1) shuffled[keys[j]] = v[keys[j]];
    assert.equal(canonicalJSON(v), canonicalJSON(shuffled));
  }
});

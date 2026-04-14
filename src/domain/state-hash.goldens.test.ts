import { describe, expect, it } from 'vitest';

import { canonicalJSON, hashEvent, hashState, sha256 } from './state-hash.js';

/**
 * Golden-fixture drift-detection tests.
 *
 * Fuzz tests (scripts/eval/canonical-json-fuzz.test.mjs) prove the runtime
 * and verifier implementations of canonicalJSON agree with each other. They
 * cannot detect drift where BOTH impls shift identically — e.g., both get
 * "fixed" to preserve -0 as "-0" — which would silently invalidate every
 * previously-archived hash.
 *
 * These goldens pin specific hex outputs so any change to canonicalJSON's
 * contract breaks CI loudly.
 *
 * K3 (scrutiny-pass). Values computed once via `node -e` against the
 * post-G2 unified canonicalizer and pinned here.
 */

describe('canonicalJSON goldens: string output is pinned', () => {
  // Each case: input, expected canonical string, (optional) excludeTopLevel
  const cases: { name: string; input: unknown; expected: string; excludeTopLevel?: boolean }[] = [
    { name: 'empty object', input: {}, expected: '{}' },
    { name: 'empty array', input: [], expected: '[]' },
    { name: 'null', input: null, expected: 'null' },
    { name: 'zero', input: 0, expected: '0' },
    { name: 'negative zero collapses to zero', input: -0, expected: '0' },
    { name: 'empty string', input: '', expected: '""' },
    {
      name: 'sorted keys insert-order-invariant',
      input: { b: 2, a: 1 },
      expected: '{"a":1,"b":2}',
    },
    { name: 'undefined properties dropped', input: { a: 1, b: undefined }, expected: '{"a":1}' },
    { name: 'empty-string key preserved', input: { '': 0 }, expected: '{"":0}' },
    {
      name: 'numeric-looking keys sort lexicographically',
      input: { '10': 'ten', '2': 'two', '1': 'one' },
      expected: '{"1":"one","10":"ten","2":"two"}',
    },
    { name: 'ASCII case order (A before a)', input: { a: 2, A: 1 }, expected: '{"A":1,"a":2}' },
    { name: 'newline in string value escaped', input: { k: 'a\nb' }, expected: '{"k":"a\\nb"}' },
    { name: 'NaN encoded as null', input: Number.NaN, expected: 'null' },
    { name: 'Infinity encoded as null', input: Number.POSITIVE_INFINITY, expected: 'null' },
    {
      name: 'excludeTopLevel drops _checksum/stateHash/prevStateHash at top',
      input: { _checksum: 'x', stateHash: 'y', prevStateHash: 'z', a: 1 },
      expected: '{"a":1}',
      excludeTopLevel: true,
    },
    {
      name: 'excludeTopLevel preserves inner stateHash (nested, not top)',
      input: { a: { stateHash: 'keep' } },
      expected: '{"a":{"stateHash":"keep"}}',
      excludeTopLevel: true,
    },
    { name: 'function encoded as null (unsupported type)', input: () => 42, expected: 'null' },
    { name: 'symbol encoded as null', input: Symbol('s'), expected: 'null' },
    {
      name: 'array with undefined element becomes null',
      input: [1, undefined, 3],
      expected: '[1,null,3]',
    },
    { name: 'deeply nested array', input: [1, [2, [3, [4]]]], expected: '[1,[2,[3,[4]]]]' },
  ];

  for (const c of cases) {
    it(`[canonical] ${c.name}`, () => {
      expect(canonicalJSON(c.input, c.excludeTopLevel ?? false)).toBe(c.expected);
    });
  }
});

describe('sha256 goldens: bytes-to-hex is pinned', () => {
  // NIST test vector (known-good external anchor).
  it('matches NIST FIPS 180-2 vector for "abc"', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  // Each case: canonical string, expected sha256. If either drifts, we catch.
  const cases: { name: string; canonical: string; expected: string }[] = [
    {
      name: 'empty object',
      canonical: '{}',
      expected: '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
    },
    {
      name: 'empty array',
      canonical: '[]',
      expected: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
    },
    {
      name: 'null',
      canonical: 'null',
      expected: '74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b',
    },
    {
      name: 'zero',
      canonical: '0',
      expected: '5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9',
    },
    {
      name: 'empty string',
      canonical: '""',
      expected: '12ae32cb1ec02d01eda3581b127c1fee3b0dc53572ed6baf239721a03d82e126',
    },
    {
      name: 'sorted kv',
      canonical: '{"a":1,"b":2}',
      expected: '43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777',
    },
    {
      name: 'empty-key object',
      canonical: '{"":0}',
      expected: '6d741b146801696dd35e34575e778730f06b2ec4bb5ccee13166f36c0761a55a',
    },
    {
      name: 'lex-sorted numeric-looking keys',
      canonical: '{"1":"one","10":"ten","2":"two"}',
      expected: '88f1d5d864d29ee7e34bed097931cc725766463ad2b97c08685f0c20dbc66b21',
    },
    {
      name: 'case-sorted keys',
      canonical: '{"A":1,"a":2}',
      expected: '0d0e3924a16d7710884d7aaf5ddacfafcef0079c6717e1415b8074f911635606',
    },
    {
      name: 'excluded-top-level fields removed',
      canonical: '{"a":1}',
      expected: '015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862',
    },
    {
      name: 'inner stateHash preserved',
      canonical: '{"a":{"stateHash":"keep"}}',
      expected: 'bbc1cc92c33d1fc53c6dc47504850688018fee5f62eb5c6d1b796e95cb30b371',
    },
  ];

  for (const c of cases) {
    it(`[sha256] ${c.name}`, () => {
      expect(sha256(c.canonical)).toBe(c.expected);
    });
  }
});

describe('hashState goldens: content-identity is pinned', () => {
  // hashState excludes _checksum/stateHash/prevStateHash at top level.
  // Bookkeeping drift (e.g., touching stateHash bookkeeping) must not shift
  // the content hash.

  it('minimal state', () => {
    const s = { a: 1 };
    expect(hashState(s)).toBe('015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862');
  });

  it('bookkeeping-invariant: adding _checksum/stateHash/prevStateHash at top does not change hash', () => {
    const base = { a: 1 };
    const withBookkeeping = {
      a: 1,
      _checksum: 'anything',
      stateHash: 'stale',
      prevStateHash: null,
    };
    expect(hashState(base)).toBe(hashState(withBookkeeping));
  });

  it('content-sensitive: changing a non-bookkeeping field changes the hash', () => {
    expect(hashState({ a: 1 })).not.toBe(hashState({ a: 2 }));
  });

  it('nested stateHash is content (not bookkeeping) for outer hash', () => {
    const s = { a: { stateHash: 'keep' } };
    expect(hashState(s)).toBe('bbc1cc92c33d1fc53c6dc47504850688018fee5f62eb5c6d1b796e95cb30b371');
  });
});

describe('hashEvent goldens: trace-chain integrity is pinned', () => {
  // hashEvent uses canonicalJSON WITHOUT excludeTopLevel, then strips
  // eventHash via destructuring only. So stateBeforeHash / stateAfterHash
  // / prevEventHash are all INCLUDED in the hash (asymmetry with hashState).

  it('minimal entry', () => {
    const e = { a: 1 };
    expect(hashEvent(e)).toBe('015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862');
  });

  it('eventHash field present does not affect hash (destructured out)', () => {
    const base = { a: 1 };
    const withStale = { a: 1, eventHash: 'stale' };
    expect(hashEvent(base)).toBe(hashEvent(withStale));
  });

  it('prevEventHash IS included in the hash (hashEvent ≠ hashState semantics)', () => {
    const chainStart = { a: 1, prevEventHash: null };
    const chainMid = { a: 1, prevEventHash: 'abc' };
    // Unlike hashState which would strip prevEventHash at top level,
    // hashEvent does not. Two entries with different chain pointers hash
    // differently — this is the property that makes the Merkle chain work.
    expect(hashEvent(chainStart)).not.toBe(hashEvent(chainMid));
  });

  it('stateAfterHash IS included (entries with different state transitions hash differently)', () => {
    const e1 = { runId: 'r', seq: 0, stateAfterHash: 'aaa' };
    const e2 = { runId: 'r', seq: 0, stateAfterHash: 'bbb' };
    expect(hashEvent(e1)).not.toBe(hashEvent(e2));
  });
});

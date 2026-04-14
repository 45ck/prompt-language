import { describe, expect, it } from 'vitest';

import { canonicalJSON, hashEvent, hashState, sha256 } from './state-hash.js';

describe('canonicalJSON', () => {
  it('sorts object keys deterministically', () => {
    expect(canonicalJSON({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it('preserves array order', () => {
    expect(canonicalJSON([3, 1, 2])).toBe('[3,1,2]');
  });

  it('drops undefined properties', () => {
    expect(canonicalJSON({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('escapes strings via JSON.stringify', () => {
    expect(canonicalJSON({ s: 'he said "hi"' })).toBe('{"s":"he said \\"hi\\""}');
  });

  it('excludes top-level checksum/hash keys when asked', () => {
    const state = { a: 1, _checksum: 'x', stateHash: 'y', prevStateHash: 'z' };
    expect(canonicalJSON(state, true)).toBe('{"a":1}');
  });
});

describe('sha256', () => {
  it('matches known vector', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('hashState', () => {
  it('is stable when bookkeeping fields change', () => {
    const a = { x: 1 };
    const b = { x: 1, _checksum: 'anything', stateHash: 'different' };
    expect(hashState(a)).toBe(hashState(b));
  });

  it('changes when content changes', () => {
    expect(hashState({ x: 1 })).not.toBe(hashState({ x: 2 }));
  });
});

describe('hashEvent', () => {
  it('ignores existing eventHash when rehashing', () => {
    const entry = { a: 1, eventHash: 'stale' };
    const expected = sha256(canonicalJSON({ a: 1 }));
    expect(hashEvent(entry)).toBe(expected);
  });
});

describe('canonicalJSON unsupported values', () => {
  it('encodes functions and symbols as null', () => {
    expect(canonicalJSON(() => 42)).toBe('null');
    expect(canonicalJSON(Symbol('s'))).toBe('null');
  });
});

describe('canonicalJSON edge cases (AP-6 lock-down)', () => {
  it('handles empty-string keys deterministically', () => {
    expect(canonicalJSON({ '': 'empty key' })).toBe('{"":"empty key"}');
  });

  it('treats -0 as 0 (matches JSON.stringify)', () => {
    // JSON.stringify(-0) === '0' — canonicalJSON delegates to it for numbers.
    expect(canonicalJSON({ a: 0, b: -0 })).toBe('{"a":0,"b":0}');
    expect(canonicalJSON(-0)).toBe('0');
  });

  it('encodes NaN and +/-Infinity as null (matches JSON.stringify)', () => {
    // JSON.stringify(NaN) === 'null', JSON.stringify(Infinity) === 'null'.
    // Locking current behavior: numbers that JSON can't represent become 'null'.
    expect(canonicalJSON(Number.NaN)).toBe('null');
    expect(canonicalJSON(Number.POSITIVE_INFINITY)).toBe('null');
    expect(canonicalJSON(Number.NEGATIVE_INFINITY)).toBe('null');
    expect(canonicalJSON({ a: Number.NaN })).toBe('{"a":null}');
  });

  it('preserves newline and control-char escapes in strings', () => {
    expect(canonicalJSON({ key: 'value\nwith\nnewlines' })).toBe(
      '{"key":"value\\nwith\\nnewlines"}',
    );
    expect(canonicalJSON({ k: '\t\r\b\f\u0001' })).toBe('{"k":"\\t\\r\\b\\f\\u0001"}');
  });

  it('is case-sensitive on keys (A and a coexist, sorted)', () => {
    // Uppercase sorts before lowercase in default string comparison.
    expect(canonicalJSON({ a: 1, A: 2 })).toBe('{"A":2,"a":1}');
  });

  it('sorts numeric-looking keys lexicographically (not numerically)', () => {
    // "10" < "2" lexicographically.
    expect(canonicalJSON({ '2': 'two', '10': 'ten', '1': 'one' })).toBe(
      '{"1":"one","10":"ten","2":"two"}',
    );
  });

  it('produces output for 1000-key objects in bounded time', () => {
    const big: Record<string, number> = {};
    for (let i = 0; i < 1000; i += 1) big[`k${i}`] = i;
    const start = Date.now();
    const out = canonicalJSON(big);
    const elapsed = Date.now() - start;
    expect(out.length).toBeGreaterThan(1000);
    expect(elapsed).toBeLessThan(500);
  });
});

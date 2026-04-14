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

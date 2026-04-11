import { describe, expect, it } from 'vitest';

import {
  decodeJsonVariableValue,
  isVariableValue,
  stringifyVariableValue,
} from './variable-value.js';

describe('isVariableValue', () => {
  it('accepts nested arrays and plain objects', () => {
    expect(
      isVariableValue({
        ok: true,
        count: 2,
        nested: ['x', 3, { done: false }],
      }),
    ).toBe(true);
  });

  it('rejects unsupported values', () => {
    expect(isVariableValue(null)).toBe(false);
    expect(isVariableValue({ bad: null })).toBe(false);
  });
});

describe('stringifyVariableValue', () => {
  it('preserves scalar strings and stringifies structured values', () => {
    expect(stringifyVariableValue('hello')).toBe('hello');
    expect(stringifyVariableValue(7)).toBe('7');
    expect(stringifyVariableValue({ ok: true, items: ['a', 'b'] })).toBe(
      '{"ok":true,"items":["a","b"]}',
    );
  });
});

describe('decodeJsonVariableValue', () => {
  it('parses JSON payloads into typed variable values', () => {
    expect(decodeJsonVariableValue('{"ok":true,"items":["a",2]}')).toEqual({
      ok: true,
      items: ['a', 2],
    });
  });

  it('falls back to the raw string for invalid or unsupported JSON', () => {
    expect(decodeJsonVariableValue('')).toBe('');
    expect(decodeJsonVariableValue('{bad json')).toBe('{bad json');
    expect(decodeJsonVariableValue('{"bad":null}')).toBe('{"bad":null}');
  });
});

import { describe, it, expect } from 'vitest';
import { initEmptyList, appendToList, listLength } from './list-variable.js';

describe('initEmptyList', () => {
  it('returns an empty JSON array string', () => {
    expect(initEmptyList()).toBe('[]');
  });
});

describe('appendToList', () => {
  it('creates a new array when current is undefined', () => {
    expect(appendToList(undefined, 'a')).toBe('["a"]');
  });

  it('appends to an empty array', () => {
    expect(appendToList('[]', 'a')).toBe('["a"]');
  });

  it('appends to an existing array', () => {
    expect(appendToList('["a"]', 'b')).toBe('["a","b"]');
  });

  it('auto-upgrades scalar string to array', () => {
    expect(appendToList('scalar', 'b')).toBe('["scalar","b"]');
  });

  it('auto-upgrades numeric value to array', () => {
    expect(appendToList(42, 'b')).toBe('["42","b"]');
  });

  it('auto-upgrades boolean value to array', () => {
    expect(appendToList(true, 'b')).toBe('["true","b"]');
  });

  it('handles multi-element arrays', () => {
    expect(appendToList('["a","b"]', 'c')).toBe('["a","b","c"]');
  });
});

describe('listLength', () => {
  it('returns 0 for undefined', () => {
    expect(listLength(undefined)).toBe(0);
  });

  it('returns 0 for non-array string', () => {
    expect(listLength('not-an-array')).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(listLength('[]')).toBe(0);
  });

  it('returns correct length for array', () => {
    expect(listLength('["a","b","c"]')).toBe(3);
  });

  it('returns 0 for numeric value', () => {
    expect(listLength(42)).toBe(0);
  });

  it('returns 0 for boolean value', () => {
    expect(listLength(true)).toBe(0);
  });
});

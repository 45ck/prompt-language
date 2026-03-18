import { describe, it, expect } from 'vitest';
import {
  isBuiltinResolver,
  createResolver,
  createResolvedVariable,
  BUILTIN_RESOLVERS,
} from './resolver.js';

describe('isBuiltinResolver', () => {
  it('returns true for each built-in name', () => {
    for (const name of BUILTIN_RESOLVERS) {
      expect(isBuiltinResolver(name)).toBe(true);
    }
  });

  it('returns false for unknown names', () => {
    expect(isBuiltinResolver('custom_thing')).toBe(false);
    expect(isBuiltinResolver('')).toBe(false);
    expect(isBuiltinResolver('TESTS_PASS')).toBe(false);
  });
});

describe('createResolver', () => {
  it('creates a deterministic resolver', () => {
    const r = createResolver('tests_pass', 'deterministic', 'exit code == 0');
    expect(r).toEqual({
      name: 'tests_pass',
      source: 'deterministic',
      description: 'exit code == 0',
    });
  });

  it('creates a parsed resolver', () => {
    const r = createResolver('coverage', 'parsed', 'extract from stdout');
    expect(r.source).toBe('parsed');
  });

  it('creates an inferred resolver', () => {
    const r = createResolver('quality', 'inferred', 'claude evaluates');
    expect(r.source).toBe('inferred');
  });

  it('creates a human resolver', () => {
    const r = createResolver('approval', 'human', 'user confirms');
    expect(r.source).toBe('human');
  });
});

describe('createResolvedVariable', () => {
  it('creates with string value', () => {
    const v = createResolvedVariable('msg', 'hello', 'parsed');
    expect(v).toEqual({ name: 'msg', value: 'hello', source: 'parsed' });
  });

  it('creates with number value', () => {
    const v = createResolvedVariable('count', 42, 'deterministic');
    expect(v.value).toBe(42);
  });

  it('creates with boolean value', () => {
    const v = createResolvedVariable('ok', true, 'inferred');
    expect(v.value).toBe(true);
  });
});

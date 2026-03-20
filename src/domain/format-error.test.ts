import { describe, it, expect } from 'vitest';
import { formatError } from './format-error.js';

describe('formatError', () => {
  it('returns stack trace for Error instances', () => {
    const err = new Error('boom');
    const result = formatError(err);
    expect(result).toContain('boom');
    expect(result).toContain('format-error.test');
  });

  it('returns message when Error has no stack', () => {
    const err = new Error('no stack');
    (err as { stack: string | undefined }).stack = undefined;
    expect(formatError(err)).toBe('no stack');
  });

  it('converts string to string', () => {
    expect(formatError('plain string')).toBe('plain string');
  });

  it('converts number to string', () => {
    expect(formatError(42)).toBe('42');
  });

  it('converts null to string', () => {
    expect(formatError(null)).toBe('null');
  });

  it('converts undefined to string', () => {
    expect(formatError(undefined)).toBe('undefined');
  });

  it('converts object to string', () => {
    expect(formatError({ code: 'ENOENT' })).toBe('[object Object]');
  });
});

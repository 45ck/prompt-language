import { describe, it, expect } from 'vitest';
import { evaluateCondition } from './evaluate-condition.js';

describe('evaluateCondition', () => {
  it('returns true for boolean true variable', () => {
    expect(evaluateCondition('command_failed', { command_failed: true })).toBe(true);
  });

  it('returns false for boolean false variable', () => {
    expect(evaluateCondition('command_failed', { command_failed: false })).toBe(false);
  });

  it('returns true for non-zero number', () => {
    expect(evaluateCondition('count', { count: 5 })).toBe(true);
  });

  it('returns false for zero number', () => {
    expect(evaluateCondition('count', { count: 0 })).toBe(false);
  });

  it('returns true for non-empty string', () => {
    expect(evaluateCondition('name', { name: 'hello' })).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(evaluateCondition('name', { name: '' })).toBe(false);
  });

  it('returns null for unknown variable', () => {
    expect(evaluateCondition('tests_pass', {})).toBeNull();
  });

  it('negates with "not" prefix', () => {
    expect(evaluateCondition('not command_failed', { command_failed: true })).toBe(false);
    expect(evaluateCondition('not command_failed', { command_failed: false })).toBe(true);
  });

  it('returns null for "not" with unknown variable', () => {
    expect(evaluateCondition('not unknown', {})).toBeNull();
  });

  it('trims whitespace in condition', () => {
    expect(evaluateCondition('  command_failed  ', { command_failed: true })).toBe(true);
  });

  it('handles "not" with whitespace', () => {
    expect(evaluateCondition('not  done', { done: true })).toBe(false);
  });
});

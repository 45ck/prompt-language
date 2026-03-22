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

  // H#1: and/or operators
  describe('and/or operators', () => {
    it('evaluates "A and B" — both true', () => {
      expect(evaluateCondition('a and b', { a: true, b: true })).toBe(true);
    });

    it('evaluates "A and B" — one false', () => {
      expect(evaluateCondition('a and b', { a: true, b: false })).toBe(false);
    });

    it('evaluates "A and B" — one unknown returns null', () => {
      expect(evaluateCondition('a and b', { a: true })).toBeNull();
    });

    it('evaluates "A and B" — false short-circuits unknown', () => {
      expect(evaluateCondition('a and b', { a: false })).toBe(false);
    });

    it('evaluates "A or B" — one true', () => {
      expect(evaluateCondition('a or b', { a: false, b: true })).toBe(true);
    });

    it('evaluates "A or B" — both false', () => {
      expect(evaluateCondition('a or b', { a: false, b: false })).toBe(false);
    });

    it('evaluates "A or B" — true short-circuits unknown', () => {
      expect(evaluateCondition('a or b', { a: true })).toBe(true);
    });

    it('evaluates "A or B" — both unknown returns null', () => {
      expect(evaluateCondition('a or b', {})).toBeNull();
    });
  });

  // H#3: Comparison operators
  describe('comparison operators', () => {
    it('evaluates == with numbers', () => {
      expect(evaluateCondition('count == 5', { count: 5 })).toBe(true);
      expect(evaluateCondition('count == 3', { count: 5 })).toBe(false);
    });

    it('evaluates != with numbers', () => {
      expect(evaluateCondition('count != 3', { count: 5 })).toBe(true);
      expect(evaluateCondition('count != 5', { count: 5 })).toBe(false);
    });

    it('evaluates > with numbers', () => {
      expect(evaluateCondition('count > 3', { count: 5 })).toBe(true);
      expect(evaluateCondition('count > 5', { count: 5 })).toBe(false);
    });

    it('evaluates < with numbers', () => {
      expect(evaluateCondition('count < 10', { count: 5 })).toBe(true);
      expect(evaluateCondition('count < 3', { count: 5 })).toBe(false);
    });

    it('evaluates >= with numbers', () => {
      expect(evaluateCondition('count >= 5', { count: 5 })).toBe(true);
      expect(evaluateCondition('count >= 6', { count: 5 })).toBe(false);
    });

    it('evaluates <= with numbers', () => {
      expect(evaluateCondition('count <= 5', { count: 5 })).toBe(true);
      expect(evaluateCondition('count <= 4', { count: 5 })).toBe(false);
    });

    it('evaluates == with strings', () => {
      expect(evaluateCondition('status == "ready"', { status: 'ready' })).toBe(true);
      expect(evaluateCondition('status == "pending"', { status: 'ready' })).toBe(false);
    });

    it('returns null for > with non-numeric strings', () => {
      expect(evaluateCondition('name > "hello"', { name: 'world' })).toBeNull();
    });
  });

  // H#6: ${var} references in comparisons
  describe('${var} references', () => {
    it('resolves ${var} on left side of comparison', () => {
      expect(evaluateCondition('${count} == 5', { count: 5 })).toBe(true);
    });

    it('resolves ${var} on right side of comparison', () => {
      expect(evaluateCondition('count == ${target}', { count: 5, target: 5 })).toBe(true);
    });

    it('resolves ${var} on both sides', () => {
      expect(evaluateCondition('${a} == ${b}', { a: 'hello', b: 'hello' })).toBe(true);
      expect(evaluateCondition('${a} != ${b}', { a: 'hello', b: 'world' })).toBe(true);
    });

    it('handles quoted strings in comparisons', () => {
      expect(evaluateCondition('status == "active"', { status: 'active' })).toBe(true);
      expect(evaluateCondition("status == 'active'", { status: 'active' })).toBe(true);
    });
  });
});

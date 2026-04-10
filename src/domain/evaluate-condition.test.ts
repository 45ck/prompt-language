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

    it('interpolates direct ${var} truthiness conditions', () => {
      expect(evaluateCondition('${ready}', { ready: 'true' })).toBe(true);
      expect(evaluateCondition('${ready}', { ready: 'false' })).toBe(false);
    });

    it('interpolates ${var} in numeric comparisons', () => {
      expect(evaluateCondition('${count} > 0', { count: 2 })).toBe(true);
      expect(evaluateCondition('${count} > 0', { count: 0 })).toBe(false);
    });
  });

  // H-LANG-012: "contains" operator
  describe('contains operator', () => {
    it('returns true when left string includes right string', () => {
      expect(
        evaluateCondition('last_stdout contains "error"', { last_stdout: 'fatal error occurred' }),
      ).toBe(true);
    });

    it('returns false when left string does not include right string', () => {
      expect(evaluateCondition('last_stdout contains "error"', { last_stdout: 'all good' })).toBe(
        false,
      );
    });

    it('works with ${var} references', () => {
      expect(evaluateCondition('${output} contains "pass"', { output: 'tests pass' })).toBe(true);
    });

    it('works with variable name on left', () => {
      expect(evaluateCondition('msg contains "hello"', { msg: 'say hello world' })).toBe(true);
    });

    it('is case-sensitive', () => {
      expect(evaluateCondition('msg contains "Hello"', { msg: 'hello world' })).toBe(false);
    });

    it('works with "not" prefix', () => {
      expect(evaluateCondition('not msg contains "error"', { msg: 'all good' })).toBe(true);
    });

    it('handles empty search string', () => {
      expect(evaluateCondition('msg contains ""', { msg: 'anything' })).toBe(true);
    });

    it('handles unresolved variable (falls through to string comparison)', () => {
      // When variable is not set, resolveOperand returns the literal token
      expect(evaluateCondition('unknown contains "x"', {})).toBe(false);
    });
  });

  // Edge cases: variable names containing operator substrings
  describe('variable names containing "and"/"or"', () => {
    it('variable name containing "and" is not split', () => {
      expect(evaluateCondition('android', { android: true })).toBe(true);
    });

    it('variable name containing "or" is not split', () => {
      expect(evaluateCondition('condor', { condor: false })).toBe(false);
    });
  });

  // Edge cases: not with comparison
  describe('"not" with comparison', () => {
    it('negates a comparison result (count > 5 with count=3)', () => {
      expect(evaluateCondition('not count > 5', { count: 3 })).toBe(true);
    });

    it('negates a true comparison (count > 5 with count=10)', () => {
      expect(evaluateCondition('not count > 5', { count: 10 })).toBe(false);
    });
  });

  // Edge cases: chained and/or with three operands
  describe('chained and/or with three operands', () => {
    it('a and b and c — all true', () => {
      expect(evaluateCondition('a and b and c', { a: true, b: true, c: true })).toBe(true);
    });

    it('a and b and c — one false', () => {
      expect(evaluateCondition('a and b and c', { a: true, b: false, c: true })).toBe(false);
    });

    it('a or b or c — last true', () => {
      expect(evaluateCondition('a or b or c', { a: false, b: false, c: true })).toBe(true);
    });

    it('a or b or c — all false', () => {
      expect(evaluateCondition('a or b or c', { a: false, b: false, c: false })).toBe(false);
    });
  });

  // Standard precedence: "and" binds tighter than "or"
  // "a or b and c" → a or (b and c)   [standard — "and" groups first]
  // "a and b or c" → (a and b) or c   [same under both standard and left-to-right]
  describe('mixed and/or — standard precedence (and before or)', () => {
    it('a or b and c → a or (b and c) — a=true, short-circuit: true', () => {
      expect(evaluateCondition('a or b and c', { a: true, b: false, c: false })).toBe(true);
    });

    it('a and b or c → (a and b) or c — a=false,b=true → false, c=true → true', () => {
      expect(evaluateCondition('a and b or c', { a: false, b: true, c: true })).toBe(true);
    });

    it('a and b or c — a=true,b=false → false, c=false → false', () => {
      expect(evaluateCondition('a and b or c', { a: true, b: false, c: false })).toBe(false);
    });

    it('a or b and c → a or (b and c) — a=false, b=true, c=true → true', () => {
      expect(evaluateCondition('a or b and c', { a: false, b: true, c: true })).toBe(true);
    });

    it('a or b and c → a or (b and c) — a=false, b=true, c=false → false', () => {
      expect(evaluateCondition('a or b and c', { a: false, b: true, c: false })).toBe(false);
    });

    it('a or b and c → a or (b and c) — a=true, b=false, c=true → true', () => {
      expect(evaluateCondition('a or b and c', { a: true, b: false, c: true })).toBe(true);
    });
  });

  // 3+ operator chains — standard precedence
  describe('3+ operator chains', () => {
    // "a and b or c and d" → (a and b) or (c and d)  [same under standard and left-to-right]
    it('a and b or c and d — first group true, second false → true', () => {
      expect(evaluateCondition('a and b or c and d', { a: true, b: true, c: false, d: true })).toBe(
        true,
      );
    });

    it('a and b or c and d — first group false, second true → true', () => {
      expect(evaluateCondition('a and b or c and d', { a: false, b: true, c: true, d: true })).toBe(
        true,
      );
    });

    it('a and b or c and d — both groups false → false', () => {
      expect(
        evaluateCondition('a and b or c and d', { a: true, b: false, c: true, d: false }),
      ).toBe(false);
    });

    // "a or b and c or d" → standard: (a or (b and c)) or d
    it('a or b and c or d — d=true → true', () => {
      expect(
        evaluateCondition('a or b and c or d', { a: false, b: false, c: false, d: true }),
      ).toBe(true);
    });

    it('a or b and c or d — a=true,d=false → true (a short-circuits)', () => {
      expect(evaluateCondition('a or b and c or d', { a: true, b: false, c: true, d: false })).toBe(
        true,
      );
    });

    it('a or b and c or d — a=false, b=true, c=false, d=false → false ((b and c) is false)', () => {
      expect(
        evaluateCondition('a or b and c or d', { a: false, b: true, c: false, d: false }),
      ).toBe(false);
    });

    it('a or b and c or d — all false → false', () => {
      expect(
        evaluateCondition('a or b and c or d', { a: false, b: false, c: false, d: false }),
      ).toBe(false);
    });
  });

  // Parenthesized conditions (fh58)
  describe('parenthesized conditions', () => {
    it('(a or b) and c — parens override precedence', () => {
      // Without parens: a or b and c = a or (b and c)
      // With parens: (a or b) and c
      expect(evaluateCondition('(a or b) and c', { a: true, b: false, c: false })).toBe(false);
      expect(evaluateCondition('(a or b) and c', { a: true, b: false, c: true })).toBe(true);
      expect(evaluateCondition('(a or b) and c', { a: false, b: false, c: true })).toBe(false);
    });

    it('a and (b or c) — parens on right side', () => {
      expect(evaluateCondition('a and (b or c)', { a: true, b: false, c: true })).toBe(true);
      expect(evaluateCondition('a and (b or c)', { a: true, b: false, c: false })).toBe(false);
      expect(evaluateCondition('a and (b or c)', { a: false, b: true, c: true })).toBe(false);
    });

    it('(a and b) or (c and d) — parens on both sides', () => {
      expect(
        evaluateCondition('(a and b) or (c and d)', { a: true, b: true, c: false, d: true }),
      ).toBe(true);
      expect(
        evaluateCondition('(a and b) or (c and d)', { a: false, b: true, c: false, d: true }),
      ).toBe(false);
    });

    it('fully parenthesized expression — strips outer parens', () => {
      expect(evaluateCondition('(a)', { a: true })).toBe(true);
      expect(evaluateCondition('(a)', { a: false })).toBe(false);
    });

    it('nested parens work', () => {
      expect(evaluateCondition('((a or b) and c)', { a: true, b: false, c: true })).toBe(true);
      expect(evaluateCondition('((a or b) and c)', { a: false, b: false, c: true })).toBe(false);
    });

    it('not (expr) — negates parenthesized expression', () => {
      expect(evaluateCondition('not (a or b)', { a: false, b: false })).toBe(true);
      expect(evaluateCondition('not (a or b)', { a: true, b: false })).toBe(false);
    });
  });

  // Edge cases: unresolved ${var} references
  describe('unresolved ${var} references in comparison', () => {
    it('${x} == ${y} with both unresolved compares literal strings', () => {
      // Both variables missing: resolveOperand returns "${x}" and "${y}" as strings
      // "${x}" == "${y}" → different strings → false
      expect(evaluateCondition('${x} == ${y}', {})).toBe(false);
    });

    it('${x} == ${x} with unresolved compares identical literal strings', () => {
      // Both resolve to "${x}" as strings → equal → true
      expect(evaluateCondition('${x} == ${x}', {})).toBe(true);
    });
  });

  // Edge cases: boundary values for <= and >=
  describe('boundary values for <= and >=', () => {
    it('<= with equal values returns true', () => {
      expect(evaluateCondition('count <= 5', { count: 5 })).toBe(true);
    });

    it('>= with lesser value returns false', () => {
      expect(evaluateCondition('count >= 10', { count: 5 })).toBe(false);
    });

    it('>= with equal values returns true', () => {
      expect(evaluateCondition('count >= 5', { count: 5 })).toBe(true);
    });

    it('<= with greater value returns false', () => {
      expect(evaluateCondition('count <= 3', { count: 5 })).toBe(false);
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  interpolate,
  shellEscapeValue,
  shellInterpolate,
  MAX_ARRAY_INDEX_PAYLOAD,
} from './interpolate.js';

describe('interpolate', () => {
  it('replaces a single variable', () => {
    expect(interpolate('Hello ${name}', { name: 'world' })).toBe('Hello world');
  });

  it('replaces multiple variables', () => {
    expect(interpolate('${a} and ${b}', { a: 'one', b: 'two' })).toBe('one and two');
  });

  it('replaces the same variable multiple times', () => {
    expect(interpolate('${x} + ${x}', { x: 'val' })).toBe('val + val');
  });

  it('leaves unknown variables as-is', () => {
    expect(interpolate('${known} ${unknown}', { known: 'yes' })).toBe('yes ${unknown}');
  });

  it('coerces number values to string', () => {
    expect(interpolate('code=${code}', { code: 42 })).toBe('code=42');
  });

  it('coerces boolean values to string', () => {
    expect(interpolate('pass=${pass}', { pass: true })).toBe('pass=true');
  });

  it('returns template unchanged when no variables match', () => {
    expect(interpolate('no vars here', { x: '1' })).toBe('no vars here');
  });

  it('returns template unchanged when no tokens present', () => {
    expect(interpolate('plain text', {})).toBe('plain text');
  });

  it('handles empty template', () => {
    expect(interpolate('', { x: '1' })).toBe('');
  });

  it('handles empty variables record', () => {
    expect(interpolate('${x}', {})).toBe('${x}');
  });

  it('handles adjacent tokens', () => {
    expect(interpolate('${a}${b}', { a: 'hello', b: 'world' })).toBe('helloworld');
  });

  // H#10: Default value syntax
  it('uses default when variable is missing', () => {
    expect(interpolate('val=${x:-fallback}end', {})).toBe('val=fallbackend');
  });

  it('uses variable value when present, ignoring default', () => {
    expect(interpolate('val=${x:-fallback}end', { x: 'real' })).toBe('val=realend');
  });

  it('uses empty default when syntax is ${var:-}', () => {
    expect(interpolate('val=${x:-}end', {})).toBe('val=end');
  });

  it('handles mixed default and plain tokens', () => {
    expect(interpolate('${a:-one} ${b}', {})).toBe('one ${b}');
  });

  // H-LANG-004: Array indexing
  describe('array indexing', () => {
    it('accesses first element with ${var[0]}', () => {
      expect(interpolate('${items[0]}', { items: '["a","b","c"]' })).toBe('a');
    });

    it('accesses last element with negative index ${var[-1]}', () => {
      expect(interpolate('${items[-1]}', { items: '["a","b","c"]' })).toBe('c');
    });

    it('returns empty string for out-of-bounds index', () => {
      expect(interpolate('${items[5]}', { items: '["a","b"]' })).toBe('');
    });

    it('returns empty string for negative out-of-bounds index', () => {
      expect(interpolate('${items[-5]}', { items: '["a","b"]' })).toBe('');
    });

    it('leaves as-is when variable is not an array', () => {
      expect(interpolate('${items[0]}', { items: 'not-json' })).toBe('${items[0]}');
    });

    it('leaves as-is when variable is not set', () => {
      expect(interpolate('${items[0]}', {})).toBe('${items[0]}');
    });

    it('accesses middle element', () => {
      expect(interpolate('${items[1]}', { items: '["x","y","z"]' })).toBe('y');
    });

    it('works alongside plain variables', () => {
      expect(
        interpolate('first=${items[0]} name=${name}', { items: '["a","b"]', name: 'test' }),
      ).toBe('first=a name=test');
    });

    it('handles numeric array values', () => {
      expect(interpolate('${nums[0]}', { nums: '[1,2,3]' })).toBe('1');
    });

    it('leaves as-is when value is a JSON object (not array)', () => {
      expect(interpolate('${obj[0]}', { obj: '{"key":"val"}' })).toBe('${obj[0]}');
    });

    it('returns null for payload exceeding MAX_ARRAY_INDEX_PAYLOAD', () => {
      const huge = '["' + 'x'.repeat(MAX_ARRAY_INDEX_PAYLOAD + 1) + '"]';
      expect(interpolate('${items[0]}', { items: huge })).toBe('${items[0]}');
    });

    it('returns null for array with more than 10000 elements', () => {
      const bigArray = JSON.stringify(Array.from({ length: 20_000 }, (_, i) => i));
      expect(interpolate('${items[0]}', { items: bigArray })).toBe('${items[0]}');
    });

    it('still works for normal small arrays', () => {
      expect(interpolate('${items[1]}', { items: '["a","b","c"]' })).toBe('b');
    });
  });
});

describe('shellEscapeValue', () => {
  it('wraps a simple value in single quotes', () => {
    expect(shellEscapeValue('hello')).toBe("'hello'");
  });

  it('escapes embedded single quotes', () => {
    expect(shellEscapeValue("it's")).toBe("'it'\\''s'");
  });

  it('neutralizes semicolons and command chaining', () => {
    expect(shellEscapeValue('a; echo INJECTED')).toBe("'a; echo INJECTED'");
  });

  it('neutralizes command substitution', () => {
    expect(shellEscapeValue('$(whoami)')).toBe("'$(whoami)'");
  });

  it('neutralizes backtick substitution', () => {
    expect(shellEscapeValue('`cat /etc/passwd`')).toBe("'`cat /etc/passwd`'");
  });

  it('handles empty string', () => {
    expect(shellEscapeValue('')).toBe("''");
  });
});

describe('shellInterpolate', () => {
  it('shell-escapes substituted values', () => {
    expect(shellInterpolate('echo ${x}', { x: 'hello' })).toBe("echo 'hello'");
  });

  it('prevents shell injection via variable values', () => {
    const result = shellInterpolate('echo ${x}', { x: 'a; rm -rf /' });
    expect(result).toBe("echo 'a; rm -rf /'");
    // The dangerous chars are neutralized by single-quoting, not removed
    expect(result).toMatch(/^echo '/);
  });

  it('leaves unknown variables as-is', () => {
    expect(shellInterpolate('echo ${unknown}', {})).toBe('echo ${unknown}');
  });

  it('returns template unchanged when no tokens present', () => {
    expect(shellInterpolate('echo hello', { x: 'val' })).toBe('echo hello');
  });

  // H#10: Default value in shell context
  it('shell-escapes default value', () => {
    expect(shellInterpolate('echo ${x:-hello}', {})).toBe("echo 'hello'");
  });

  // H-LANG-004: Array indexing in shell context
  it('shell-escapes array element access', () => {
    expect(shellInterpolate('echo ${items[0]}', { items: '["hello","world"]' })).toBe(
      "echo 'hello'",
    );
  });

  it('leaves array access as-is when variable not set', () => {
    expect(shellInterpolate('echo ${items[0]}', {})).toBe('echo ${items[0]}');
  });
});

// ── Dot-notation variable access (Feature: prompt_json flat keys) ──────────
describe('interpolate — dot-notation flat key access', () => {
  it('resolves ${foo.bar} from flat key "foo.bar" in variables', () => {
    const result = interpolate('severity is ${foo.bar}', { 'foo.bar': 'high' });
    expect(result).toBe('severity is high');
  });

  it('resolves multiple dot-notation references in one template', () => {
    const result = interpolate('${a.x} and ${a.y}', { 'a.x': 'alpha', 'a.y': 'beta' });
    expect(result).toBe('alpha and beta');
  });

  it('leaves ${foo.bar} unchanged when flat key not in variables', () => {
    expect(interpolate('${foo.bar}', {})).toBe('${foo.bar}');
  });

  it('does not confuse plain name with dot-notation key', () => {
    const result = interpolate('${foo} ${foo.bar}', { foo: 'plain', 'foo.bar': 'dotted' });
    expect(result).toBe('plain dotted');
  });
});

describe('shellInterpolate — dot-notation flat key access', () => {
  it('shell-escapes ${foo.bar} resolved from flat key', () => {
    const result = shellInterpolate('echo ${foo.bar}', { 'foo.bar': 'hello world' });
    expect(result).toBe("echo 'hello world'");
  });

  it('leaves ${foo.bar} unchanged when flat key not present', () => {
    expect(shellInterpolate('echo ${foo.bar}', {})).toBe('echo ${foo.bar}');
  });
});

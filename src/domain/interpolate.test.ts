import { describe, it, expect } from 'vitest';
import { interpolate, shellEscapeValue, shellInterpolate } from './interpolate.js';

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
});

import { describe, it, expect } from 'vitest';
import { interpolate } from './interpolate.js';

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

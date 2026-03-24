import { describe, it, expect } from 'vitest';
import { applyTransform } from './transforms.js';

describe('applyTransform', () => {
  it('trim removes leading and trailing whitespace', () => {
    expect(applyTransform('  hello  ', 'trim')).toBe('hello');
  });

  it('trim removes newlines', () => {
    expect(applyTransform('\nhello\n', 'trim')).toBe('hello');
  });

  it('upper converts to uppercase', () => {
    expect(applyTransform('hello world', 'upper')).toBe('HELLO WORLD');
  });

  it('lower converts to lowercase', () => {
    expect(applyTransform('Hello World', 'lower')).toBe('hello world');
  });

  it('first returns first line', () => {
    expect(applyTransform('line1\nline2\nline3', 'first')).toBe('line1');
  });

  it('first returns empty string for empty input', () => {
    expect(applyTransform('', 'first')).toBe('');
  });

  it('last returns last non-empty line', () => {
    expect(applyTransform('line1\nline2\nline3', 'last')).toBe('line3');
  });

  it('last skips trailing empty lines', () => {
    expect(applyTransform('line1\nline2\n', 'last')).toBe('line2');
  });

  it('last returns empty string for empty input', () => {
    expect(applyTransform('', 'last')).toBe('');
  });

  it('unknown transform returns value as-is', () => {
    expect(applyTransform('hello', 'unknown')).toBe('hello');
  });

  it('transform name is case-insensitive', () => {
    expect(applyTransform('hello', 'UPPER')).toBe('HELLO');
    expect(applyTransform('  hi  ', 'Trim')).toBe('hi');
  });

  it('first with single line returns that line', () => {
    expect(applyTransform('only', 'first')).toBe('only');
  });

  it('last with single line returns that line', () => {
    expect(applyTransform('only', 'last')).toBe('only');
  });
});

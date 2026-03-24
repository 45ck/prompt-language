import { describe, it, expect } from 'vitest';
import { evaluateArithmetic } from './arithmetic.js';

describe('evaluateArithmetic', () => {
  // Basic operations
  it('adds two numbers', () => {
    expect(evaluateArithmetic('3 + 5')).toBe(8);
  });

  it('subtracts two numbers', () => {
    expect(evaluateArithmetic('10 - 3')).toBe(7);
  });

  it('multiplies two numbers', () => {
    expect(evaluateArithmetic('4 * 6')).toBe(24);
  });

  it('divides two numbers', () => {
    expect(evaluateArithmetic('15 / 3')).toBe(5);
  });

  it('calculates modulo', () => {
    expect(evaluateArithmetic('10 % 3')).toBe(1);
  });

  // Multi-term (left-to-right, no precedence)
  it('evaluates multi-term addition left to right', () => {
    expect(evaluateArithmetic('1 + 2 + 3')).toBe(6);
  });

  it('evaluates multi-term subtraction left to right', () => {
    expect(evaluateArithmetic('10 - 2 - 3')).toBe(5);
  });

  it('evaluates mixed operators left to right (no precedence)', () => {
    // 2 + 3 * 4 => (2+3)*4 = 20 (left-to-right, NOT 2+(3*4)=14)
    expect(evaluateArithmetic('2 + 3 * 4')).toBe(20);
  });

  // Negative numbers
  it('handles leading negative number', () => {
    expect(evaluateArithmetic('-5 + 3')).toBe(-2);
  });

  it('handles negative result', () => {
    expect(evaluateArithmetic('3 - 10')).toBe(-7);
  });

  // Integer division
  it('truncates integer division toward zero', () => {
    expect(evaluateArithmetic('7 / 2')).toBe(3);
  });

  it('truncates negative division toward zero', () => {
    expect(evaluateArithmetic('-7 / 2')).toBe(-3);
  });

  // Division by zero
  it('returns null for division by zero', () => {
    expect(evaluateArithmetic('5 / 0')).toBeNull();
  });

  it('returns null for modulo by zero', () => {
    expect(evaluateArithmetic('5 % 0')).toBeNull();
  });

  // Not arithmetic
  it('returns null for plain text', () => {
    expect(evaluateArithmetic('hello')).toBeNull();
  });

  it('returns null for text with operators', () => {
    expect(evaluateArithmetic('hello + world')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(evaluateArithmetic('')).toBeNull();
  });

  // Single number
  it('returns single number as-is', () => {
    expect(evaluateArithmetic('42')).toBe(42);
  });

  it('returns single negative number', () => {
    expect(evaluateArithmetic('-7')).toBe(-7);
  });

  // Spacing variants
  it('handles no spaces around operator', () => {
    expect(evaluateArithmetic('3+5')).toBe(8);
  });

  it('handles extra spaces', () => {
    expect(evaluateArithmetic(' 3 + 5 ')).toBe(8);
  });

  it('handles mixed spacing', () => {
    expect(evaluateArithmetic('3 +5')).toBe(8);
  });

  // Edge cases
  it('handles zero', () => {
    expect(evaluateArithmetic('0')).toBe(0);
  });

  it('handles zero addition', () => {
    expect(evaluateArithmetic('0 + 0')).toBe(0);
  });

  it('handles large numbers', () => {
    expect(evaluateArithmetic('1000000 + 1')).toBe(1000001);
  });

  it('returns null for trailing operator', () => {
    expect(evaluateArithmetic('3 +')).toBeNull();
  });

  it('returns null for leading operator (non-negative)', () => {
    expect(evaluateArithmetic('+ 3')).toBeNull();
  });

  it('returns null for double operators', () => {
    expect(evaluateArithmetic('3 ++ 5')).toBeNull();
  });

  it('returns null for floating point numbers', () => {
    expect(evaluateArithmetic('3.5 + 2')).toBeNull();
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { add, multiply, divide } from './math.mjs';

test('add returns the sum', () => {
  assert.equal(add(2, 3), 5);
  assert.equal(add(0, 0), 0);
  assert.equal(add(-1, 1), 0);
});

test('multiply returns the product', () => {
  assert.equal(multiply(2, 3), 6);
  assert.equal(multiply(0, 5), 0);
  assert.equal(multiply(-2, 3), -6);
});

test('divide returns the quotient', () => {
  assert.equal(divide(6, 2), 3);
  assert.equal(divide(10, 5), 2);
  assert.equal(divide(0, 1), 0);
});

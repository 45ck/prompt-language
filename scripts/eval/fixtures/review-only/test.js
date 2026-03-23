const assert = require('node:assert');
const { calculate } = require('./app');

// Basic arithmetic
assert.strictEqual(calculate('2 + 3'), 5);
assert.strictEqual(calculate('10 - 4'), 6);
assert.strictEqual(calculate('3 * 4'), 12);
assert.strictEqual(calculate('8 / 2'), 4);

// Operator precedence (Bug 1)
assert.strictEqual(calculate('2 + 3 * 4'), 14);
assert.strictEqual(calculate('10 - 2 * 3'), 4);

// Division by zero (Bug 2)
assert.throws(() => calculate('5 / 0'), /division by zero/i);

// Edge cases
assert.strictEqual(calculate('0 + 0'), 0);
assert.strictEqual(calculate('100'), 100);

console.log('All tests passed');

const { isEven, isPositive } = require('./app');
const assert = require('node:assert');

assert.strictEqual(isEven(2), true, '2 is even');
assert.strictEqual(isEven(3), false, '3 is odd');
assert.strictEqual(isEven(0), true, '0 is even');
assert.strictEqual(isEven(-4), true, '-4 is even');
assert.strictEqual(isPositive(5), true, '5 is positive');
assert.strictEqual(isPositive(-1), false, '-1 is not positive');
assert.strictEqual(isPositive(0), false, '0 is not positive');

console.log('All tests passed');

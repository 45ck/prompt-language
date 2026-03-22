const { divide, safeDivide } = require('./app');
const assert = require('node:assert');

assert.strictEqual(divide(10, 2), 5, '10 / 2 = 5');
assert.strictEqual(divide(9, 3), 3, '9 / 3 = 3');
assert.strictEqual(divide(7, 2), 3.5, '7 / 2 = 3.5');
assert.throws(() => divide(1, 0), /Division by zero/);
assert.strictEqual(safeDivide(10, 0), 0, 'safe divide by zero returns fallback');
assert.strictEqual(safeDivide(10, 0, -1), -1, 'custom fallback works');

console.log('All tests passed');

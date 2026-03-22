const { add, multiply } = require('./app');
const assert = require('node:assert');

assert.strictEqual(add(2, 3), 5, 'add(2, 3) should be 5');
assert.strictEqual(add(-1, 1), 0, 'add(-1, 1) should be 0');
assert.strictEqual(add(0, 0), 0, 'add(0, 0) should be 0');
assert.strictEqual(multiply(3, 4), 12, 'multiply(3, 4) should be 12');

console.log('All tests passed');

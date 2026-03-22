const { range } = require('./app');
const assert = require('node:assert');

assert.deepStrictEqual(range(0), [], 'range(0) should be []');
assert.deepStrictEqual(range(1), [0], 'range(1) should be [0]');
assert.deepStrictEqual(range(3), [0, 1, 2], 'range(3) should be [0, 1, 2]');
assert.deepStrictEqual(range(5), [0, 1, 2, 3, 4], 'range(5) should be [0, 1, 2, 3, 4]');

console.log('All tests passed');

const { classify } = require('./app');
const assert = require('node:assert');

assert.strictEqual(classify(42), 'number');
assert.strictEqual(classify('hi'), 'string');
assert.strictEqual(classify([1, 2]), 'array');
assert.strictEqual(classify(null), 'unknown', 'null should be unknown');
assert.strictEqual(classify({}), 'unknown', 'object should be unknown');
assert.strictEqual(classify(true), 'unknown', 'boolean should be unknown');

console.log('All tests passed');

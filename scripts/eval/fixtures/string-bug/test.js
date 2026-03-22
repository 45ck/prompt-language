const { capitalize, truncate } = require('./app');
const assert = require('node:assert');

assert.strictEqual(capitalize('hello'), 'Hello');
assert.strictEqual(capitalize('world'), 'World');
assert.strictEqual(capitalize(''), '');
assert.strictEqual(capitalize('A'), 'A');
assert.strictEqual(capitalize('already'), 'Already');
assert.strictEqual(truncate('hello world', 5), 'hello...');
assert.strictEqual(truncate('hi', 5), 'hi');

console.log('All tests passed');

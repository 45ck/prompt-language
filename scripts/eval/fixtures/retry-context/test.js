const assert = require('node:assert');
const { parseConfig } = require('./app');

// Test 1: Simple flat config
const flat = parseConfig('{"host":"localhost","port":3000}');
assert.strictEqual(flat.host, 'localhost', 'flat string value should be preserved');
assert.strictEqual(
  flat.port,
  3000,
  'flat numeric value should remain a number, not become a string',
);

// Test 2: Nested config flattening
const nested = parseConfig('{"db":{"host":"127.0.0.1","port":5432,"ssl":true}}');
assert.strictEqual(nested['db.host'], '127.0.0.1', 'nested string should be preserved');
assert.strictEqual(nested['db.port'], 5432, 'nested numeric value should remain a number');
assert.strictEqual(nested['db.ssl'], true, 'nested boolean value should remain a boolean');

// Test 3: Mixed nesting with arrays preserved
const mixed = parseConfig('{"app":{"name":"myapp","tags":["web","api"]}}');
assert.strictEqual(mixed['app.name'], 'myapp', 'nested string should work');
assert.deepStrictEqual(
  mixed['app.tags'],
  ['web', 'api'],
  'array values should be preserved as arrays',
);

// Test 4: Null values preserved
const withNull = parseConfig('{"setting":null}');
assert.strictEqual(
  withNull.setting,
  null,
  'null values should remain null, not become the string "null"',
);

console.log('All tests passed');

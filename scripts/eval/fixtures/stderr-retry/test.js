const assert = require('node:assert');
const { mergeObjects } = require('./app');

// Test 1: Flat merge — source overrides target
const r1 = mergeObjects({ a: 1, b: 2 }, { b: 10, c: 3 });
assert.strictEqual(r1.a, 1, 'Expected target key "a" to be 1');
assert.strictEqual(
  r1.b,
  10,
  'Expected source key "b" to override target: should be 10, got ' + r1.b,
);
assert.strictEqual(r1.c, 3, 'Expected source key "c" to be 3');

// Test 2: Deep merge — nested source values override nested target values
const r2 = mergeObjects({ db: { host: 'old-host', port: 5432 } }, { db: { host: 'new-host' } });
assert.strictEqual(
  r2.db.host,
  'new-host',
  'Expected nested key "db.host" to be "new-host" (from source), got "' + r2.db.host + '"',
);
assert.strictEqual(
  r2.db.port,
  5432,
  'Expected nested key "db.port" to be preserved from target: should be 5432, got ' + r2.db.port,
);

// Test 3: Deep merge — new nested keys added from source
const r3 = mergeObjects({ config: { verbose: false } }, { config: { debug: true, level: 3 } });
assert.strictEqual(
  r3.config.verbose,
  false,
  'Expected "config.verbose" from target to remain false',
);
assert.strictEqual(
  r3.config.debug,
  true,
  'Expected "config.debug" from source to be true, got ' + r3.config.debug,
);
assert.strictEqual(
  r3.config.level,
  3,
  'Expected "config.level" from source to be 3, got ' + r3.config.level,
);

// Test 4: Three-level deep merge
const r4 = mergeObjects({ a: { b: { c: 1, d: 2 } } }, { a: { b: { c: 99 } } });
assert.strictEqual(
  r4.a.b.c,
  99,
  'Expected "a.b.c" to be 99 (overridden by source), got ' + r4.a.b.c,
);
assert.strictEqual(
  r4.a.b.d,
  2,
  'Expected "a.b.d" to be 2 (preserved from target), got ' + r4.a.b.d,
);

// Test 5: Arrays are replaced, not merged
const r5 = mergeObjects({ tags: [1, 2] }, { tags: [3, 4, 5] });
assert.deepStrictEqual(r5.tags, [3, 4, 5], 'Expected "tags" array to be fully replaced by source');

// Test 6: No mutation of inputs
const target6 = { x: { y: 1 } };
const source6 = { x: { z: 2 } };
mergeObjects(target6, source6);
assert.strictEqual(
  target6.x.z,
  undefined,
  'Expected original target to be unmodified — target.x.z should be undefined',
);

console.log('All tests passed');

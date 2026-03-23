const assert = require('node:assert');
const { flatten, groupBy, unique } = require('./app');

// flatten: basic
assert.deepStrictEqual(flatten([1, [2, 3], 4]), [1, 2, 3, 4]);
assert.deepStrictEqual(flatten([1, [2, [3]], 4], 1), [1, 2, [3], 4]);
assert.deepStrictEqual(flatten([1, [2, [3]], 4], 2), [1, 2, 3, 4]);
assert.deepStrictEqual(flatten([]), []);

// groupBy: basic
const people = [
  { name: 'Alice', dept: 'eng' },
  { name: 'Bob', dept: 'eng' },
  { name: 'Carol', dept: 'sales' },
];
const grouped = groupBy(people, (p) => p.dept);
assert.strictEqual(grouped.eng.length, 2);
assert.strictEqual(grouped.sales.length, 1);
assert.strictEqual(grouped.eng[0].name, 'Alice');

// unique: basic
assert.deepStrictEqual(unique([1, 2, 3, 2, 1]), [1, 2, 3]);
assert.deepStrictEqual(unique(['a', 'b', 'a']), ['a', 'b']);
assert.deepStrictEqual(unique([]), []);

console.log('All tests passed');

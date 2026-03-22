const { flatten, unique } = require('./app');
const assert = require('node:assert');

assert.deepStrictEqual(flatten([1, [2, 3], [4]]), [1, 2, 3, 4]);
assert.deepStrictEqual(
  flatten([
    [1, 2],
    [3, 4],
  ]),
  [1, 2, 3, 4],
);
assert.deepStrictEqual(flatten([1, 2, 3]), [1, 2, 3]);
assert.deepStrictEqual(flatten([]), []);
assert.deepStrictEqual(unique([1, 2, 2, 3, 3, 3]), [1, 2, 3]);
assert.deepStrictEqual(unique([]), []);

console.log('All tests passed');

const assert = require('node:assert');
const { r, c, z } = require('./app');

// r: repeat items
assert.deepStrictEqual(r(['a', 'b'], 2), ['a', 'a', 'b', 'b']);
assert.deepStrictEqual(r([1, 2, 3], 1), [1, 2, 3]);
assert.deepStrictEqual(r([], 5), []);

// c: count occurrences
assert.deepStrictEqual(c(['a', 'b', 'a', 'c', 'b', 'a']), { a: 3, b: 2, c: 1 });
assert.deepStrictEqual(c([1, 1, 2]), { 1: 2, 2: 1 });
assert.deepStrictEqual(c([]), {});

// z: zip arrays (should use min length)
assert.deepStrictEqual(z([1, 2], ['a', 'b']), [
  [1, 'a'],
  [2, 'b'],
]);
assert.deepStrictEqual(z([1, 2, 3], ['a']), [[1, 'a']]);
assert.deepStrictEqual(z([], [1, 2]), []);

console.log('All tests passed');

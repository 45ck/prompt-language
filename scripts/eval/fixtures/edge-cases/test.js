const { countOccurrences, padCenter, wrap, slugify } = require('./app');
const assert = require('node:assert');

// countOccurrences — basic
assert.strictEqual(countOccurrences('hello world', 'o'), 2);
assert.strictEqual(countOccurrences('aaa', 'a'), 3);
assert.strictEqual(countOccurrences('hello', 'xyz'), 0);
assert.strictEqual(countOccurrences('', 'a'), 0);
assert.strictEqual(countOccurrences('hello', ''), 0);

// padCenter
assert.strictEqual(padCenter('hi', 6), '  hi  ');
assert.strictEqual(padCenter('hi', 7), '  hi   ');
assert.strictEqual(padCenter('hello', 5), 'hello');
assert.strictEqual(padCenter('hi', 6, '*'), '**hi**');
assert.strictEqual(padCenter('x', 4, '-'), '-x--');

// wrap: basic word wrapping
assert.strictEqual(wrap('hello world foo bar', 10), 'hello\nworld foo\nbar');
assert.strictEqual(wrap('short', 10), 'short');
assert.strictEqual(wrap('a b c d e', 3), 'a b\nc d\ne');

// slugify
assert.strictEqual(slugify('Hello World'), 'hello-world');
assert.strictEqual(slugify('  foo  bar  '), 'foo-bar');
assert.strictEqual(slugify('Hello---World'), 'hello-world');
assert.strictEqual(slugify('CamelCase Test'), 'camelcase-test');

console.log('All tests passed');

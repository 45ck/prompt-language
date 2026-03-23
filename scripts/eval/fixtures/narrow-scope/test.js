const assert = require('node:assert');
const { parseDate, formatDate, daysBetween } = require('./app');

// parseDate: valid dates
assert.deepStrictEqual(parseDate('2024-01-15'), { year: 2024, month: 1, day: 15 });
assert.deepStrictEqual(parseDate('2000-12-31'), { year: 2000, month: 12, day: 31 });

// parseDate: invalid input should return null (Bug 1 — currently throws)
assert.strictEqual(parseDate(null), null);
assert.strictEqual(parseDate(undefined), null);
assert.strictEqual(parseDate(''), null);
assert.strictEqual(parseDate('not-a-date'), null);

// formatDate: should zero-pad (Bug 2)
assert.strictEqual(formatDate({ year: 2024, month: 3, day: 5 }), '2024-03-05');
assert.strictEqual(formatDate({ year: 2024, month: 12, day: 25 }), '2024-12-25');

// daysBetween: should return absolute value (Bug 3)
const jan1 = { year: 2024, month: 1, day: 1 };
const feb1 = { year: 2024, month: 2, day: 1 };
assert.strictEqual(daysBetween(jan1, feb1), 30);
assert.strictEqual(daysBetween(feb1, jan1), 30);

console.log('All tests passed');

const assert = require('node:assert');
const { formatCurrency } = require('./app');

// Basic formatting with 2 decimal places
assert.strictEqual(formatCurrency(1234.5, 'USD'), '$1,234.50', 'USD should have 2 decimal places');
assert.strictEqual(
  formatCurrency(1000, 'EUR'),
  '\u20AC1,000.00',
  'EUR whole number should show .00',
);
assert.strictEqual(formatCurrency(19.9, 'GBP'), '\u00A319.90', 'GBP should have 2 decimal places');

// Edge cases
assert.strictEqual(formatCurrency(0, 'USD'), '$0.00', 'zero should format as $0.00');
assert.strictEqual(formatCurrency(0.5, 'USD'), '$0.50', 'half dollar should show as $0.50');
assert.strictEqual(formatCurrency(1000000, 'USD'), '$1,000,000.00', 'millions should have commas');

// Negative amounts
assert.strictEqual(
  formatCurrency(-49.99, 'USD'),
  '-$49.99',
  'negative amounts should have leading minus',
);

// Rounding to 2 decimal places
assert.strictEqual(formatCurrency(9.999, 'USD'), '$10.00', 'should round to 2 decimal places');

// Unknown currency fallback
assert.strictEqual(
  formatCurrency(100, 'JPY'),
  'JPY 100.00',
  'unknown currency should use code as prefix',
);

console.log('All tests passed');

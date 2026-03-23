const assert = require('node:assert');
const { validateEmail } = require('./app');

// Valid emails that should return true
assert.strictEqual(validateEmail('user@example.com'), true, 'simple email should be valid');
assert.strictEqual(
  validateEmail('first.last@example.com'),
  true,
  'dots in local part should be valid',
);
assert.strictEqual(
  validateEmail('user.name+tag@domain.co'),
  true,
  'dots and plus in local part should be valid',
);
assert.strictEqual(
  validateEmail('a.b.c@test.org'),
  true,
  'multiple dots in local part should be valid',
);

// Invalid emails that should return false
assert.strictEqual(validateEmail(''), false, 'empty string should be invalid');
assert.strictEqual(validateEmail('noatsign'), false, 'missing @ should be invalid');
assert.strictEqual(validateEmail('@domain.com'), false, 'missing local part should be invalid');
assert.strictEqual(validateEmail('user@'), false, 'missing domain should be invalid');
assert.strictEqual(validateEmail(null), false, 'null should be invalid');
assert.strictEqual(validateEmail(42), false, 'number should be invalid');

console.log('All tests passed');

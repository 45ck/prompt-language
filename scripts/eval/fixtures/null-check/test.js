const { getDisplayName, getInitials } = require('./app');
const assert = require('node:assert');

assert.strictEqual(getDisplayName({ firstName: 'John', lastName: 'Doe' }), 'John Doe');
assert.strictEqual(getDisplayName({ firstName: 'Jane', lastName: 'Smith' }), 'Jane Smith');
assert.strictEqual(getDisplayName(null), 'Anonymous', 'null user returns Anonymous');
assert.strictEqual(getDisplayName({}), 'Anonymous', 'empty object returns Anonymous');
assert.strictEqual(getInitials({ firstName: 'John', lastName: 'Doe' }), 'JD');
assert.strictEqual(getInitials(null), '??', 'null user returns ??');

console.log('All tests passed');

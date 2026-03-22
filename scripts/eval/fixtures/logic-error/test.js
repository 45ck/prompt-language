const { letterGrade, isPassing, clamp } = require('./app');
const assert = require('node:assert');

// letterGrade tests
assert.strictEqual(letterGrade(95), 'A');
assert.strictEqual(letterGrade(85), 'B');
assert.strictEqual(letterGrade(75), 'C');
assert.strictEqual(letterGrade(65), 'D');
assert.strictEqual(letterGrade(55), 'F');

// isPassing: 60 and above is passing
assert.strictEqual(isPassing(60), true, '60 should be passing');
assert.strictEqual(isPassing(59), false, '59 should be failing');
assert.strictEqual(isPassing(100), true);

// clamp: should constrain value to [min, max]
assert.strictEqual(clamp(5, 0, 10), 5, '5 in [0,10] = 5');
assert.strictEqual(clamp(-5, 0, 10), 0, '-5 clamped to 0');
assert.strictEqual(clamp(15, 0, 10), 10, '15 clamped to 10');
assert.strictEqual(clamp(10, 0, 10), 10, '10 at boundary = 10');
assert.strictEqual(clamp(0, 0, 10), 0, '0 at boundary = 0');

console.log('All tests passed');

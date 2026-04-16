const { verifyToken } = require('./src/auth');
const { isValidEmail } = require('./src/validate');
const { capitalize } = require('./src/format');

let failures = 0;

function assert(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label} — expected ${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`PASS: ${label}`);
  }
}

// auth tests
assert(verifyToken('Bearer abc123'), true, 'valid token');
assert(verifyToken(null), false, 'null token should not throw');

// validate tests
assert(isValidEmail('user@example.com'), true, 'valid email');
assert(isValidEmail('a@b'), false, 'a@b should be invalid');

// format tests
assert(capitalize('hello'), 'Hello', 'capitalize hello');
assert(capitalize(''), '', 'capitalize empty');

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll tests passed');

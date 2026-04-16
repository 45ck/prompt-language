const { factorial } = require('./math');

let failures = 0;

function assert(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label} — expected ${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`PASS: ${label}`);
  }
}

assert(factorial(0), 1, 'factorial(0)');
assert(factorial(1), 1, 'factorial(1)');
assert(factorial(5), 120, 'factorial(5)');
assert(factorial(10), 3628800, 'factorial(10)');

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll tests passed');

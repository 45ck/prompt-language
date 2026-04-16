const { add, divide } = require('./app');

let failures = 0;

function assert(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label} — expected ${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`PASS: ${label}`);
  }
}

assert(add(2, 3), 5, 'add(2, 3)');
assert(divide(10, 2), 5, 'divide(10, 2)');
assert(divide(10, 0), Infinity, 'divide(10, 0) should throw or return Infinity');

// The real check: divide by zero should throw, not return Infinity
try {
  const result = divide(1, 0);
  if (!Number.isFinite(result)) {
    throw new Error('divide by zero must throw');
  }
  console.log('PASS: divide(1, 0) throws');
} catch (e) {
  if (e.message === 'divide by zero must throw') {
    console.error('FAIL: divide(1, 0) returned non-finite instead of throwing');
    failures++;
  } else {
    console.log('PASS: divide(1, 0) throws');
  }
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll tests passed');

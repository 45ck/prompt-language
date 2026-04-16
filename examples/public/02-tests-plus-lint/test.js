const { capitalize, greet } = require('./src/utils');

let failures = 0;

function assert(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label} — expected "${expected}", got "${actual}"`);
    failures++;
  } else {
    console.log(`PASS: ${label}`);
  }
}

assert(capitalize('hello'), 'Hello', 'capitalize("hello")');
assert(greet('world'), 'Hello world', 'greet("world")');

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll tests passed');

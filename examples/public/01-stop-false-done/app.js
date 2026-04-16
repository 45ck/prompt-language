// A simple calculator with a divide-by-zero bug.
// Can you spot it?

function add(a, b) {
  return a + b;
}

function divide(a, b) {
  return a / b; // Bug: no check for b === 0
}

module.exports = { add, divide };

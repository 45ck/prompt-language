// Deliberately-broken math module for E1 Pattern 1 experiment.
// Each function has a single-character/operator bug.

export function add(a, b) {
  return a - b;
}

export function multiply(a, b) {
  return a + b;
}

export function divide(a, b) {
  return a * b;
}

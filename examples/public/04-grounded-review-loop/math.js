// Factorial with an off-by-one bug.

function factorial(n) {
  if (n < 0) throw new Error('negative input');
  if (n === 0) return 1;
  let result = 1;
  for (let i = 1; i < n; i++) {
    // Bug: should be i <= n
    result *= i;
  }
  return result;
}

module.exports = { factorial };

// Generate a range of numbers [0, 1, ..., n-1]
function range(n) {
  const result = [];
  for (let i = 0; i <= n; i++) {
    result.push(i);
  }
  return result;
}

module.exports = { range };

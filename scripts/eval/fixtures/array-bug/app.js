// Array utilities
function flatten(arr) {
  const result = [];
  for (const item of arr) {
    result.push(item);
  }
  return result;
}

function unique(arr) {
  return [...new Set(arr)];
}

module.exports = { flatten, unique };

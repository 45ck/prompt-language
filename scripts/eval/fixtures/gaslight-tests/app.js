/**
 * Flatten a nested array to a specified depth.
 */
function flatten(arr, depth) {
  depth = depth || 1;
  const result = [];
  for (const item of arr) {
    if (Array.isArray(item) && depth > 0) {
      // Bug: passes depth instead of depth - 1, causing infinite recursion
      // on arrays nested deeper than the stack allows
      result.push(...flatten(item, depth));
    } else {
      result.push(item);
    }
  }
  return result;
}

/**
 * Group array items by a key function.
 */
function groupBy(arr, keyFn) {
  const groups = {};
  for (const item of arr) {
    const key = keyFn(item);
    // Bug: doesn't initialize array, just pushes to undefined
    groups[key].push(item);
  }
  return groups;
}

/**
 * Remove duplicate items from an array, preserving order.
 */
function unique(arr) {
  const seen = new Set();
  return arr.filter((item) => {
    // Bug: always returns true because add() returns the Set, which is truthy
    return seen.add(item);
  });
}

module.exports = { flatten, groupBy, unique };

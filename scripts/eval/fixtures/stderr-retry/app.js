/**
 * Deep merges a source object into a target object.
 * Nested objects are merged recursively. Arrays are replaced, not concatenated.
 * Returns a new object (does not mutate inputs).
 *
 * mergeObjects({a: 1, b: {c: 2}}, {b: {d: 3}}) => {a: 1, b: {c: 2, d: 3}}
 */
function mergeObjects(target, source) {
  const result = {};

  // Copy all target keys
  for (const key of Object.keys(target)) {
    if (typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])) {
      result[key] = mergeObjects(target[key], {});
    } else {
      result[key] = target[key];
    }
  }

  // Merge source keys
  for (const key of Object.keys(source)) {
    if (
      typeof source[key] === 'object' &&
      source[key] !== null &&
      !Array.isArray(source[key]) &&
      typeof result[key] === 'object' &&
      result[key] !== null
    ) {
      // Bug: passes source[key] as target and result[key] as source,
      // so existing target values overwrite new source values in nested merges
      result[key] = mergeObjects(source[key], result[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

module.exports = { mergeObjects };

/**
 * Parses a config string (JSON) and returns a flattened key-value object.
 * Nested keys are joined with dots: { "db": { "host": "localhost" } } => { "db.host": "localhost" }
 */
function parseConfig(input) {
  const obj = JSON.parse(input);
  const result = {};

  function flatten(current, prefix) {
    for (const key of Object.keys(current)) {
      const fullKey = prefix ? prefix + '.' + key : key;
      if (
        typeof current[key] === 'object' &&
        current[key] !== null &&
        !Array.isArray(current[key])
      ) {
        flatten(current[key], fullKey);
      } else {
        // Bug: converts all values to strings, breaking numeric and boolean values
        result[fullKey] = String(current[key]);
      }
    }
  }

  flatten(obj, '');
  return result;
}

module.exports = { parseConfig };

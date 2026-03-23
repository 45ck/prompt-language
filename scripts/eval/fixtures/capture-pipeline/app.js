/**
 * Two-stage pipeline:
 * 1. extractFields(rawData) — extracts a schema from a raw data object
 * 2. generateValidator(schema) — generates a validator function from the schema
 *
 * Schema format: [{ path: "key.subkey", type: "string"|"number"|"boolean"|"array"|"object" }]
 */

function extractFields(rawData, prefix) {
  prefix = prefix || '';
  const fields = [];

  for (const key of Object.keys(rawData)) {
    const fullPath = prefix ? prefix + '.' + key : key;
    const value = rawData[key];

    if (Array.isArray(value)) {
      fields.push({ path: fullPath, type: 'array' });
    } else if (typeof value === 'object' && value !== null) {
      // Bug: pushes the parent object field but does NOT recurse into nested objects,
      // so nested fields like "address.city" are never extracted
      fields.push({ path: fullPath, type: 'object' });
    } else {
      fields.push({ path: fullPath, type: typeof value });
    }
  }

  return fields;
}

function generateValidator(schema) {
  return function validate(data) {
    const errors = [];

    for (const field of schema) {
      const parts = field.path.split('.');
      let current = data;

      for (const part of parts) {
        if (current === undefined || current === null) {
          current = undefined;
          break;
        }
        current = current[part];
      }

      if (current === undefined) {
        errors.push(`Missing field: ${field.path}`);
        continue;
      }

      const actualType = Array.isArray(current) ? 'array' : typeof current;
      if (actualType !== field.type) {
        errors.push(`Type mismatch at "${field.path}": expected ${field.type}, got ${actualType}`);
      }
    }

    return { valid: errors.length === 0, errors };
  };
}

module.exports = { extractFields, generateValidator };

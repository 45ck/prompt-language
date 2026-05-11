export function validateConfig(config, schema) {
  const errors = [];
  for (const [key, definition] of Object.entries(schema)) {
    if (definition.required && !(key in config)) {
      errors.push(`Missing required key: ${key}`);
    } else if (key in config && config[key] !== null && config[key] !== undefined) {
      const actualType = typeof config[key];
      if (actualType !== definition.type) {
        errors.push(`Key '${key}' has wrong type: expected ${definition.type}, got ${actualType}`);
      }
    }
  }
  return errors;
}
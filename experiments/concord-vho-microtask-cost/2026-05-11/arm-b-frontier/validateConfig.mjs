export function validateConfig(config, schema) {
  const errs = [];
  for (const [k, spec] of Object.entries(schema)) {
    if (!(k in config)) {
      if (spec.required) errs.push(`missing required key: ${k}`);
      continue;
    }
    if (typeof config[k] !== spec.type) {
      errs.push(`${k}: expected ${spec.type}, got ${typeof config[k]}`);
    }
  }
  return errs;
}

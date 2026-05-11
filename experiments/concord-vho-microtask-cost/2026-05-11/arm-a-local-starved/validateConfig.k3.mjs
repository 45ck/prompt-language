export function validateConfig(config, schema) {
  const errors = [];
  
  for (const key in schema) {
    if (schema.hasOwnProperty(key)) {
      const rule = schema[key];
      const value = config[key];
      
      if (rule.required && (value === undefined || value === null)) {
        errors.push(`Missing required field: ${key}`);
      }
      
      if (value !== undefined && value !== null) {
        if (rule.type && typeof value !== rule.type) {
          errors.push(`Field ${key} must be of type ${rule.type}`);
        }
        
        if (rule.enum && !rule.enum.includes(value)) {
          errors.push(`Field ${key} must be one of: ${rule.enum.join(', ')}`);
        }
        
        if (rule.min && value < rule.min) {
          errors.push(`Field ${key} must be at least ${rule.min}`);
        }
        
        if (rule.max && value > rule.max) {
          errors.push(`Field ${key} must be at most ${rule.max}`);
        }
        
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`Field ${key} must be at least ${rule.minLength} characters long`);
        }
        
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`Field ${key} must be at most ${rule.maxLength} characters long`);
        }
      }
    }
  }
  
  return errors;
}
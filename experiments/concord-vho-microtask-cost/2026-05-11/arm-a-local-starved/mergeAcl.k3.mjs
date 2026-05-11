export function mergeAcl(rules) {
  const result = {};
  
  for (const rule of rules) {
    for (const [role, permissions] of Object.entries(rule)) {
      if (!result[role]) {
        result[role] = new Set();
      }
      
      for (const permission of permissions) {
        result[role].add(permission);
      }
    }
  }
  
  return Object.fromEntries(
    Object.entries(result).map(([role, permissions]) => [role, Array.from(permissions)])
  );
}
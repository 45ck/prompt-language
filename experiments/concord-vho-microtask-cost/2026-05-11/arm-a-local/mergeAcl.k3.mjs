export function mergeAcl(rules) {
  const result = new Map();
  
  for (const rule of rules) {
    const { role, perms } = rule;
    if (!result.has(role)) {
      result.set(role, new Set());
    }
    const existingPerms = result.get(role);
    for (const perm of perms) {
      existingPerms.add(perm);
    }
  }
  
  return result;
}
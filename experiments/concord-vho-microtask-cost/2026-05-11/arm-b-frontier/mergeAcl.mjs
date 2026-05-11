export function mergeAcl(rules) {
  const out = new Map();
  for (const { role, perms } of rules) {
    if (!out.has(role)) out.set(role, new Set());
    const set = out.get(role);
    for (const p of perms) set.add(p);
  }
  return out;
}

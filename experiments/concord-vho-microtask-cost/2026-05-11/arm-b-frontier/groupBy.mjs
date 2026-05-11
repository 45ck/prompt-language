export function groupBy(items, keyFn) {
  const out = {};
  for (const item of items) {
    const k = String(keyFn(item));
    if (!(k in out)) out[k] = [];
    out[k].push(item);
  }
  return out;
}

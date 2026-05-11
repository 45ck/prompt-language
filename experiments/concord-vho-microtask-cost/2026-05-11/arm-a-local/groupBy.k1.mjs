export function groupBy(items, keyFn) {
  const result = {};
  for (const item of items) {
    const key = String(keyFn(item));
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }
  return result;
}
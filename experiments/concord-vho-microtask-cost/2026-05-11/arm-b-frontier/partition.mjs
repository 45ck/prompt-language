export function partition(arr, pred) {
  const t = [],
    f = [];
  for (const x of arr) (pred(x) ? t : f).push(x);
  return [t, f];
}

export function parseQuery(qs) {
  if (!qs) return {};
  const s = qs.startsWith('?') ? qs.slice(1) : qs;
  if (!s) return {};
  const out = {};
  for (const pair of s.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const k = eq === -1 ? pair : pair.slice(0, eq);
    const v = eq === -1 ? '' : pair.slice(eq + 1);
    out[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return out;
}

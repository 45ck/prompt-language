export function parseQuery(qs) {
  const result = {};
  if (!qs) return result;
  const query = qs.startsWith('?') ? qs.substring(1) : qs;
  if (!query) return result;
  const pairs = query.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=', 2);
    const decodedKey = decodeURIComponent(key.replace(/\+/g, ' '));
    const decodedValue = value !== undefined ? decodeURIComponent(value.replace(/\+/g, ' ')) : '';
    result[decodedKey] = decodedValue;
  }
  return result;
}

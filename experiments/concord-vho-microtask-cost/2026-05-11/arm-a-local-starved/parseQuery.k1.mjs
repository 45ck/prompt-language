export function parseQuery(qs) {
  const result = {};
  if (!qs) return result;

  const pairs = qs.replace(/^\?/, '').split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    const decodedKey = decodeURIComponent(key);
    const decodedValue = value ? decodeURIComponent(value) : '';

    if (Object.prototype.hasOwnProperty.call(result, decodedKey)) {
      if (Array.isArray(result[decodedKey])) {
        result[decodedKey].push(decodedValue);
      } else {
        result[decodedKey] = [result[decodedKey], decodedValue];
      }
    } else {
      result[decodedKey] = decodedValue;
    }
  }

  return result;
}

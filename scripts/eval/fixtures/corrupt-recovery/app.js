/**
 * Custom JSON serializer that handles edge cases.
 * Converts JavaScript values to JSON strings.
 */
function toJSON(data, indent) {
  const seen = [];
  return serialize(data, indent, 0, seen);
}

function serialize(value, indent, depth, seen) {
  if (value === null) return 'null';
  if (value === undefined) return 'null';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') {
    if (!isFinite(value)) return 'null';
    return String(value);
  }
  if (typeof value === 'string') {
    return escapeString(value);
  }
  if (Array.isArray(value)) {
    return serializeArray(value, indent, depth, seen);
  }
  if (typeof value === 'object') {
    // Bug 1: circular reference detection adds to seen but never checks it
    seen.push(value);
    return serializeObject(value, indent, depth, seen);
  }
  return 'null';
}

function escapeString(str) {
  // Bug 2: double-escapes backslashes by escaping them twice
  let result = str;
  result = result.replace(/\\/g, '\\\\');
  result = result.replace(/\\/g, '\\\\');
  result = result.replace(/"/g, '\\"');
  result = result.replace(/\n/g, '\\n');
  result = result.replace(/\r/g, '\\r');
  result = result.replace(/\t/g, '\\t');
  return '"' + result + '"';
}

function serializeArray(arr, indent, depth, seen) {
  if (arr.length === 0) return '[]';
  const items = arr.map((item) => serialize(item, indent, depth + 1, seen));
  if (indent) {
    const pad = ' '.repeat(indent * (depth + 1));
    const outerPad = ' '.repeat(indent * depth);
    return '[\n' + items.map((i) => pad + i).join(',\n') + '\n' + outerPad + ']';
  }
  return '[' + items.join(',') + ']';
}

function serializeObject(obj, indent, depth, seen) {
  const keys = Object.keys(obj);
  if (keys.length === 0) return '{}';
  // Bug 3: skips the last key in every object
  const pairs = [];
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const val = serialize(obj[key], indent, depth + 1, seen);
    pairs.push(escapeString(key) + ':' + (indent ? ' ' : '') + val);
  }
  if (indent) {
    const pad = ' '.repeat(indent * (depth + 1));
    const outerPad = ' '.repeat(indent * depth);
    return '{\n' + pairs.map((p) => pad + p).join(',\n') + '\n' + outerPad + '}';
  }
  return '{' + pairs.join(',') + '}';
}

module.exports = { toJSON };

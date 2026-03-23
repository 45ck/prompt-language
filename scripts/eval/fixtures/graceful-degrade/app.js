/**
 * Compresses data by run-length encoding (RLE).
 * Attempts an optimized path that sorts characters first for better compression,
 * then decompresses back to original order.
 *
 * compress("aaabbc") => something like "3a2b1c" (with order metadata)
 * decompress(compressed) => original string
 */
function compress(data) {
  if (typeof data !== 'string' || data.length === 0) {
    return { compressed: '', order: [] };
  }

  // Optimized path: sort characters to group them for better RLE ratios
  const chars = data.split('');
  const order = chars.map((ch, i) => ({ ch, i }));
  order.sort((a, b) => a.ch.localeCompare(b.ch));

  const sorted = order.map((o) => o.ch).join('');

  // Bug: store original indices but accidentally sort them too,
  // which destroys the mapping needed for decompression
  const indices = order.map((o) => o.i);
  indices.sort((a, b) => a - b);

  // Run-length encode the sorted string
  let compressed = '';
  let i = 0;
  while (i < sorted.length) {
    let count = 1;
    while (i + count < sorted.length && sorted[i + count] === sorted[i]) {
      count++;
    }
    compressed += count + sorted[i];
    i += count;
  }

  return { compressed, indices };
}

function decompress(result) {
  if (!result.compressed) return '';

  // Decode RLE
  const decoded = [];
  const re = /(\d+)(.)/g;
  let match;
  while ((match = re.exec(result.compressed)) !== null) {
    const count = parseInt(match[1], 10);
    const ch = match[2];
    for (let i = 0; i < count; i++) {
      decoded.push(ch);
    }
  }

  // Restore original order using indices
  const original = new Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    original[result.indices[i]] = decoded[i];
  }

  return original.join('');
}

module.exports = { compress, decompress };

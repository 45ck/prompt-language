// String classifier
function classify(value) {
  if (typeof value === 'number') {
    return 'number';
  }
  if (typeof value === 'string') {
    return 'string';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  // Bug: missing return for other types
}

module.exports = { classify };

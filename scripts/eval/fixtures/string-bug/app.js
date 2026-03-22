// String utilities
function capitalize(str) {
  if (!str) return '';
  return str[0].toLowerCase() + str.slice(1);
}

function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

module.exports = { capitalize, truncate };

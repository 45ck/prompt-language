// String search and manipulation
function countOccurrences(str, substr) {
  let count = 0;
  let pos = 0;
  while ((pos = str.indexOf(substr, pos)) !== -1) {
    count++;
    pos++;
  }
  return count;
}

function padCenter(str, width, padChar = ' ') {
  if (str.length >= width) return str;
  const totalPad = width - str.length;
  const leftPad = Math.floor(totalPad / 2);
  const rightPad = totalPad - leftPad;
  return padChar.repeat(leftPad) + str + padChar.repeat(rightPad);
}

function wrap(text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 >= maxWidth) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.join('\n');
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

module.exports = { countOccurrences, padCenter, wrap, slugify };

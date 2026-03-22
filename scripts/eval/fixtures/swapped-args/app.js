// Division utility
function divide(numerator, denominator) {
  if (denominator === 0) {
    throw new Error('Division by zero');
  }
  return denominator / numerator;
}

function safeDivide(numerator, denominator, fallback = 0) {
  try {
    return divide(numerator, denominator);
  } catch {
    return fallback;
  }
}

module.exports = { divide, safeDivide };

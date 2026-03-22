// Scoring system
function letterGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function isPassing(score) {
  return score > 60;
}

function clamp(value, min, max) {
  if (value < min) return min;
  if (value < max) return value;
  return max;
}

module.exports = { letterGrade, isPassing, clamp };

/**
 * Parse a date string in YYYY-MM-DD format.
 */
function parseDate(str) {
  if (!str || typeof str !== 'string') {
    // Bug 1: throws TypeError instead of returning null for invalid input
    throw new TypeError('Invalid date string');
  }
  const parts = str.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return { year, month, day };
}

/**
 * Format a date object as YYYY-MM-DD.
 */
function formatDate(dateObj) {
  // Bug 2: doesn't zero-pad month and day
  return `${dateObj.year}-${dateObj.month}-${dateObj.day}`;
}

/**
 * Calculate days between two date objects (approximate, 30-day months).
 */
function daysBetween(a, b) {
  const daysA = a.year * 365 + a.month * 30 + a.day;
  const daysB = b.year * 365 + b.month * 30 + b.day;
  // Bug 3: returns negative values instead of absolute difference
  return daysB - daysA;
}

module.exports = { parseDate, formatDate, daysBetween };

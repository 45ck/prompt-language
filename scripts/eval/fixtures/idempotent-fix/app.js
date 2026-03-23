/**
 * Formats a numeric amount as a currency string.
 * Examples:
 *   formatCurrency(1234.5, 'USD') => '$1,234.50'
 *   formatCurrency(1000, 'EUR')   => '\u20AC1,000.00'
 *   formatCurrency(19.9, 'GBP')   => '\u00A31,9.90'  // Bug is here
 */
function formatCurrency(amount, currency) {
  const symbols = { USD: '$', EUR: '\u20AC', GBP: '\u00A3' };
  const symbol = symbols[currency] || currency + ' ';

  // Bug: uses toFixed(1) instead of toFixed(2), giving only 1 decimal place
  const parts = Math.abs(amount).toFixed(1).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decPart = parts[1];

  const sign = amount < 0 ? '-' : '';
  return sign + symbol + intPart + '.' + decPart;
}

module.exports = { formatCurrency };

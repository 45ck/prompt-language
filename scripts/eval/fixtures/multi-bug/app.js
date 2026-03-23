// Shopping cart with multiple bugs
function calculateTotal(items) {
  let total = 0;
  for (const item of items) {
    total += item.price * item.qty;
  }
  return total;
}

function applyDiscount(total, discountPercent) {
  return total - total * (discountPercent / 10);
}

function formatPrice(cents) {
  return '$' + (cents / 100).toFixed(2);
}

function validateCart(items) {
  if (!items || items.length === 0) return { valid: false, error: 'Cart is empty' };
  for (const item of items) {
    if (item.qty < 0) return { valid: false, error: 'Invalid quantity' };
    if (item.price <= 0) return { valid: false, error: 'Invalid price' };
  }
  return { valid: true };
}

module.exports = { calculateTotal, applyDiscount, formatPrice, validateCart };

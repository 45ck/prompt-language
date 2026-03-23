const { calculateTotal, applyDiscount, formatPrice, validateCart } = require('./app');
const assert = require('node:assert');

// calculateTotal tests
assert.strictEqual(calculateTotal([{ price: 100, qty: 2 }]), 200);
assert.strictEqual(
  calculateTotal([
    { price: 100, qty: 2 },
    { price: 50, qty: 1 },
  ]),
  250,
);
assert.strictEqual(calculateTotal([]), 0);

// applyDiscount: 20% off $100 = $80
assert.strictEqual(applyDiscount(10000, 20), 8000, '20% off 10000 = 8000');
assert.strictEqual(applyDiscount(5000, 10), 4500, '10% off 5000 = 4500');
assert.strictEqual(applyDiscount(1000, 0), 1000, '0% off = no change');
assert.strictEqual(applyDiscount(1000, 100), 0, '100% off = 0');

// formatPrice
assert.strictEqual(formatPrice(1099), '$10.99');
assert.strictEqual(formatPrice(500), '$5.00');
assert.strictEqual(formatPrice(0), '$0.00');

// validateCart
assert.deepStrictEqual(validateCart([]), { valid: false, error: 'Cart is empty' });
assert.deepStrictEqual(validateCart(null), { valid: false, error: 'Cart is empty' });
assert.deepStrictEqual(validateCart([{ price: 100, qty: 1 }]), { valid: true });
assert.deepStrictEqual(validateCart([{ price: 100, qty: 0 }]), { valid: true }, 'qty 0 is valid');
assert.deepStrictEqual(validateCart([{ price: 100, qty: -1 }]), {
  valid: false,
  error: 'Invalid quantity',
});
assert.deepStrictEqual(validateCart([{ price: 0, qty: 1 }]), {
  valid: false,
  error: 'Invalid price',
});

console.log('All tests passed');

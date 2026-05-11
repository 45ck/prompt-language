export function applyDiscountTier(cartTotal, tiers) {
  let pct = 0;
  for (const [min, p] of tiers) {
    if (cartTotal >= min) pct = p;
    else break;
  }
  return cartTotal * (1 - pct / 100);
}

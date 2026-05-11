export function applyDiscountTier(cartTotal, tiers) {
  let discount = 0;
  for (const tier of tiers) {
    if (cartTotal >= tier.minAmount) {
      discount = tier.discount;
    }
  }
  return cartTotal * (1 - discount);
}
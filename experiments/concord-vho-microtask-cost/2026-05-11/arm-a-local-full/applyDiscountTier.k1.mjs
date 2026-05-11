export function applyDiscountTier(cartTotal, tiers) {
  if (!tiers || tiers.length === 0) return cartTotal;

  let applicableTier = null;

  for (const [minTotal, percentOff] of tiers) {
    if (minTotal <= cartTotal) {
      applicableTier = [minTotal, percentOff];
    } else {
      break;
    }
  }

  if (applicableTier) {
    const [, percentOff] = applicableTier;
    return cartTotal * (1 - percentOff / 100);
  }

  return cartTotal;
}

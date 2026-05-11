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
    
    if (!applicableTier) return cartTotal;
    
    const [_, percentOff] = applicableTier;
    return cartTotal * (1 - percentOff / 100);
}
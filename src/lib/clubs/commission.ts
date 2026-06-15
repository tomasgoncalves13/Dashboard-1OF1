// Flat-tier commission calculator.
// commissionTiers: [{upTo: 100, rate: 0.25}, {upTo: 300, rate: 0.30}, {upTo: null, rate: 0.35}]
//
// The rate of the tier that contains the revenue applies to the ENTIRE revenue.
// Example: revenue = 115€ → exceeds 100 threshold → 30% × 115 = 34.50€
// Example: revenue = 55€  → within 100 threshold  → 25% × 55  = 13.75€

export type CommissionTier = {
  upTo: number | null; // null = unlimited (top bracket)
  rate: number;        // 0–1
};

export function calculateProgressiveCommission(
  revenue: number,
  tiers: CommissionTier[],
): number {
  if (revenue <= 0 || tiers.length === 0) return 0;

  // Sort ascending by upTo (null last)
  const sorted = [...tiers].sort((a, b) => {
    if (a.upTo === null) return 1;
    if (b.upTo === null) return -1;
    return a.upTo - b.upTo;
  });

  // Find the first tier where revenue fits (revenue <= upTo), fallback to last tier
  const tier = sorted.find((t) => t.upTo === null || revenue <= t.upTo) ?? sorted[sorted.length - 1];
  return Math.round(revenue * tier.rate * 100) / 100;
}

// Calculate commission for a club for a given month's revenue.
// Returns 0 if commissionEnabled is false.
export function calcClubCommission(
  monthlyRevenue: number,
  commissionEnabled: boolean,
  tiersJson: unknown,
): number {
  if (!commissionEnabled) return 0;
  const tiers = parseTiers(tiersJson);
  return calculateProgressiveCommission(monthlyRevenue, tiers);
}

function parseTiers(raw: unknown): CommissionTier[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (t): t is CommissionTier =>
      typeof t === "object" && t !== null && "rate" in t,
  );
}

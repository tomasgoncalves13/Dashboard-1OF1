// Progressive commission calculator (like tax brackets).
// commissionTiers: [{upTo: 100, rate: 0.25}, {upTo: 300, rate: 0.30}, {upTo: null, rate: 0.35}]
//
// Example: revenue = 500€
//   First 100€  → 25% = 25€
//   Next  200€  → 30% = 60€  (100→300)
//   Remaining 200€ → 35% = 70€  (300→500)
//   Total: 155€

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

  let commission = 0;
  let remaining = revenue;
  let prevThreshold = 0;

  for (const tier of sorted) {
    if (remaining <= 0) break;
    const bandTop = tier.upTo ?? Infinity;
    const bandSize = bandTop - prevThreshold;
    const slice = Math.min(remaining, bandSize);
    commission += slice * tier.rate;
    remaining -= slice;
    prevThreshold = bandTop === Infinity ? prevThreshold : bandTop;
  }

  return Math.round(commission * 100) / 100;
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

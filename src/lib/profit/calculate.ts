import type { Prisma } from "@prisma/client";
import type { ShopifyOrderNode } from "@/lib/shopify/types";

// Computes the per-order profit breakdown from a Shopify order payload.
// Logic:
//   COGS         = Σ lineItem.quantity * variant.inventoryItem.unitCost
//   paymentFees  = Σ transaction.fees.amount (capture/sale kinds)
//   shippingCost = NOT in Shopify — comes from manual setting (default 0)
//   packagingCost= NOT in Shopify — pulled from product/variant.packagingCost
//   attributedAd = computed later by the ad attribution job (default 0)
//
//   grossProfit  = total - refunded - COGS
//   netProfit    = grossProfit - shippingCost - packagingCost - paymentFees
//                              - attributedAd - influencerCost - otherCosts
//
// Returns Decimal-compatible strings so we can write straight to Prisma.

type Variant = { id: string; unitCost: Prisma.Decimal | null; packagingCost: Prisma.Decimal | null };

export type ProfitBreakdown = {
  cogsTotal: string;
  shippingCost: string;       // what WE paid (0 until configured)
  packagingCost: string;
  paymentFees: string;
  attributedAdSpend: string;  // 0 here; ad-attribution job updates later
  influencerCost: string;     // 0 here
  otherCosts: string;
  grossProfit: string;
  netProfit: string;
  marginPct: string | null;
};

export function calculateOrderProfit(
  order: ShopifyOrderNode,
  variantById: Map<string, Variant>,
): ProfitBreakdown {
  let cogs = 0;
  let packaging = 0;

  for (const { node: line } of order.lineItems.edges) {
    const variantGid = line.variant?.id ?? null;
    const dbVariant = variantGid ? variantById.get(variantGid) : null;

    // Prefer the unit cost we have on the variant; fall back to Shopify's
    // inventoryItem.unitCost if our DB hasn't ingested it yet.
    const unitCostStr =
      dbVariant?.unitCost?.toString() ??
      line.variant?.inventoryItem?.unitCost?.amount ??
      "0";
    cogs += Number(unitCostStr) * line.quantity;

    const pkg = dbVariant?.packagingCost?.toString() ?? "0";
    packaging += Number(pkg) * line.quantity;
  }

  let fees = 0;
  for (const tx of order.transactions ?? []) {
    if (tx.status !== "SUCCESS") continue;
    if (!["SALE", "CAPTURE"].includes(tx.kind)) continue;
    for (const f of tx.fees ?? []) fees += Number(f.amount.amount);
  }

  const total = Number(order.totalPriceSet.shopMoney.amount);
  const refunded = Number(order.totalRefundedSet.shopMoney.amount);
  const revenueNet = total - refunded;

  const shippingCost = 0;        // configured per-store later
  const attributedAd = 0;
  const influencer = 0;
  const other = 0;

  const grossProfit = revenueNet - cogs;
  const netProfit = grossProfit - shippingCost - packaging - fees - attributedAd - influencer - other;
  const margin = revenueNet > 0 ? netProfit / revenueNet : null;

  const f = (n: number) => n.toFixed(2);
  return {
    cogsTotal: f(cogs),
    shippingCost: f(shippingCost),
    packagingCost: f(packaging),
    paymentFees: f(fees),
    attributedAdSpend: f(attributedAd),
    influencerCost: f(influencer),
    otherCosts: f(other),
    grossProfit: f(grossProfit),
    netProfit: f(netProfit),
    marginPct: margin === null ? null : margin.toFixed(4),
  };
}

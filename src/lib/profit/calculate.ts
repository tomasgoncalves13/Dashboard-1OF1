import type { Prisma } from "@prisma/client";
import type { ShopifyOrderNode } from "@/lib/shopify/types";
import type { OrderOverheads } from "./order-costs";

// Per-order profit breakdown.
//
// packagingCost = bubbleMailer + card + sticker + freeGift (1× grip socks per order, always)
// grossProfit   = revenueNet - COGS
// netProfit     = grossProfit - packagingCost - paymentFees - shippingCost - adSpend - influencer - other

type Variant = { id: string; unitCost: Prisma.Decimal | null; packagingCost: Prisma.Decimal | null };

export type ProfitBreakdown = {
  cogsTotal: string;
  shippingCost: string;
  packagingCost: string;
  paymentFees: string;
  attributedAdSpend: string;
  influencerCost: string;
  otherCosts: string;
  grossProfit: string;
  netProfit: string;
  marginPct: string | null;
};

export function calculateOrderProfit(
  order: ShopifyOrderNode,
  variantById: Map<string, Variant>,
  overheads: OrderOverheads,
): ProfitBreakdown {
  let cogs = 0;

  for (const { node: line } of order.lineItems.edges) {
    // Skip free-gift items (price = 0) — their cost is already in packagingCost.freeGiftCost
    if (Number(line.discountedUnitPriceSet.shopMoney.amount) === 0) continue;
    const variantGid = line.variant?.id ?? null;
    const dbVariant = variantGid ? variantById.get(variantGid) : null;
    const unitCostStr =
      dbVariant?.unitCost?.toString() ??
      line.variant?.inventoryItem?.unitCost?.amount ??
      "0";
    cogs += Number(unitCostStr) * line.quantity;
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

  // Per-order overheads (from OrderCostConfig)
  const packaging = overheads.totalPerOrder;
  const shippingCost = ["PT", "Portugal"].includes(order.shippingAddress?.countryCodeV2 ?? "")
    ? overheads.shippingDomestic
    : overheads.shippingEU;
  const attributedAd = 0;   // filled later by ad-attribution job
  const influencer = 0;
  const other = 0;

  const grossProfit = revenueNet - cogs;
  const netProfit = grossProfit - packaging - fees - shippingCost - attributedAd - influencer - other;
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

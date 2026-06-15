import { prisma } from "@/lib/prisma";
import { getOrderOverheads } from "./order-costs";

// Recalculates profit for ALL orders using current ProductVariant.unitCost.
// Matches by variantId first, falls back to SKU when variantId is null (orders
// synced before variant linking was set up). Also normalises shippingCountry to
// the ISO code ("PT") so the domestic rate is applied correctly.

const DOMESTIC_COUNTRIES = new Set(["PT", "Portugal"]);

export async function recalculateAllOrderProfits(storeId: string): Promise<{ updated: number }> {
  const overheads = await getOrderOverheads(storeId);
  const overhead = overheads.totalPerOrder;

  // Load all variants once — two lookup maps: by id and by sku
  const variants = await prisma.productVariant.findMany({
    where: { storeId },
    select: { id: true, sku: true, unitCost: true },
  });
  const costByVariantId = new Map(variants.map((v) => [v.id, Number(v.unitCost ?? 0)]));
  const costByVariantSku = new Map(
    variants
      .filter((v) => v.sku)
      .map((v) => [v.sku!.trim().toLowerCase(), Number(v.unitCost ?? 0)]),
  );

  let skip = 0;
  const take = 100;
  let updated = 0;

  while (true) {
    const orders = await prisma.order.findMany({
      where: { storeId },
      select: {
        id: true,
        total: true,
        refundedTotal: true,
        paymentFees: true,
        shippingCountry: true,
        attributedAdSpend: true,
        influencerCost: true,
        otherCosts: true,
        items: { select: { id: true, variantId: true, sku: true, unitCost: true, quantity: true } },
      },
      skip,
      take,
      orderBy: { processedAt: "asc" },
    });

    if (orders.length === 0) break;

    for (const order of orders) {
      let cogs = 0;

      for (const item of order.items) {
        let currentCost: number;

        if (item.variantId && costByVariantId.has(item.variantId)) {
          currentCost = costByVariantId.get(item.variantId)!;
        } else if (item.sku && costByVariantSku.has(item.sku.trim().toLowerCase())) {
          currentCost = costByVariantSku.get(item.sku.trim().toLowerCase())!;
        } else {
          currentCost = Number(item.unitCost);
        }

        cogs += currentCost * item.quantity;

        if (currentCost !== Number(item.unitCost)) {
          await prisma.orderItem.update({
            where: { id: item.id },
            data: {
              unitCost: currentCost.toFixed(2),
              totalCost: (currentCost * item.quantity).toFixed(2),
            },
          });
        }
      }

      const revenueNet = Number(order.total) - Number(order.refundedTotal);
      const fees = Number(order.paymentFees);

      // Handle both "Portugal" (old syncs) and "PT" (new syncs with countryCodeV2)
      const isDomestic = DOMESTIC_COUNTRIES.has(order.shippingCountry ?? "");
      const shipping = isDomestic ? overheads.shippingDomestic : overheads.shippingEU;
      const normalizedCountry = isDomestic ? "PT" : (order.shippingCountry ?? null);

      const ad = Number(order.attributedAdSpend);
      const influencer = Number(order.influencerCost);
      const other = Number(order.otherCosts);

      const grossProfit = revenueNet - cogs;
      const netProfit = grossProfit - overhead - fees - shipping - ad - influencer - other;
      const marginPct = revenueNet > 0 ? netProfit / revenueNet : null;

      await prisma.order.update({
        where: { id: order.id },
        data: {
          cogsTotal: cogs.toFixed(2),
          shippingCost: shipping.toFixed(2),
          packagingCost: overhead.toFixed(2),
          grossProfit: grossProfit.toFixed(2),
          netProfit: netProfit.toFixed(2),
          marginPct: marginPct !== null ? marginPct.toFixed(4) : null,
          shippingCountry: normalizedCountry,
        },
      });
      updated++;
    }

    skip += take;
  }

  return { updated };
}

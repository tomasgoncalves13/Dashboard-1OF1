import { prisma } from "@/lib/prisma";
import { getOrderOverheads } from "./order-costs";

// Recalculates profit for ALL orders using current ProductVariant.unitCost (not the
// stale snapshot in OrderItem). Also refreshes OrderItem.unitCost so future runs stay correct.

export async function recalculateAllOrderProfits(storeId: string): Promise<{ updated: number }> {
  const overheads = await getOrderOverheads(storeId);
  const overhead = overheads.totalPerOrder;

  // Load all variants for this store once — used to resolve unitCost per item
  const variants = await prisma.productVariant.findMany({
    where: { storeId },
    select: { id: true, unitCost: true },
  });
  const costByVariantId = new Map(
    variants.map((v) => [v.id, Number(v.unitCost ?? 0)]),
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
        items: { select: { id: true, variantId: true, unitCost: true, quantity: true } },
      },
      skip,
      take,
      orderBy: { processedAt: "asc" },
    });

    if (orders.length === 0) break;

    for (const order of orders) {
      let cogs = 0;

      // Update each OrderItem with the current variant cost, then sum COGS
      for (const item of order.items) {
        const currentCost = item.variantId
          ? (costByVariantId.get(item.variantId) ?? Number(item.unitCost))
          : Number(item.unitCost);

        cogs += currentCost * item.quantity;

        // Refresh the snapshot so future recalculations don't regress
        if (item.variantId && currentCost !== Number(item.unitCost)) {
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
      const shipping = order.shippingCountry === "PT"
        ? overheads.shippingDomestic
        : overheads.shippingEU;
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
        },
      });
      updated++;
    }

    skip += take;
  }

  return { updated };
}

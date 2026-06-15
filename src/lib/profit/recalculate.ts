import { prisma } from "@/lib/prisma";
import { getOrderOverheads } from "./order-costs";

// Recalculates profit for ALL orders in a store using the current OrderCostConfig.
// Used when costs are updated (e.g., user changes bubble mailer price) or on first setup.
// Runs in batches to avoid memory exhaustion on large order histories.

export async function recalculateAllOrderProfits(storeId: string): Promise<{ updated: number }> {
  const overheads = await getOrderOverheads(storeId);
  const overhead = overheads.totalPerOrder;

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
        items: { select: { unitCost: true, quantity: true } },
      },
      skip,
      take,
      orderBy: { processedAt: "asc" },
    });

    if (orders.length === 0) break;

    for (const order of orders) {
      const cogs = order.items.reduce(
        (sum, item) => sum + Number(item.unitCost) * item.quantity,
        0,
      );
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

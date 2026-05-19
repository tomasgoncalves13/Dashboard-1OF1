import { prisma } from "@/lib/prisma";

// Computes one day of rolled-up analytics. Idempotent — overwrites existing row for that date.
// Covers both ecommerce (Shopify orders) and physical sales (ManualSale).

export async function computeAnalyticsSnapshot(storeId: string, dateISO: string) {
  const day = new Date(dateISO + "T00:00:00Z");
  const next = new Date(day);
  next.setUTCDate(next.getUTCDate() + 1);

  // ── Ecommerce (Shopify orders) ────────────────────────────
  const orders = await prisma.order.findMany({
    where: { storeId, processedAt: { gte: day, lt: next } },
    select: {
      total: true,
      refundedTotal: true,
      cogsTotal: true,
      shippingCost: true,
      paymentFees: true,
      attributedAdSpend: true,
      influencerCost: true,
      otherCosts: true,
      grossProfit: true,
      netProfit: true,
      customerId: true,
      customer: { select: { firstOrderAt: true } },
    },
  });

  const sum = (k: keyof (typeof orders)[number]) =>
    orders.reduce((acc, o) => acc + Number((o as Record<string, unknown>)[k] ?? 0), 0);

  const customerIds = new Set<string>();
  let newCount = 0;
  for (const o of orders) {
    if (o.customerId) customerIds.add(o.customerId);
    if (o.customer?.firstOrderAt && o.customer.firstOrderAt >= day && o.customer.firstOrderAt < next) {
      newCount++;
    }
  }

  const expenseAgg = await prisma.expense.aggregate({
    where: { storeId, incurredOn: day },
    _sum: { amount: true },
  });

  // ── Physical sales (clubs + self) ────────────────────────
  const physicalSales = await prisma.manualSale.findMany({
    where: { storeId, soldAt: { gte: day, lt: next } },
    select: { total: true, cogsTotal: true, grossProfit: true },
  });

  const physicalRevenue = physicalSales.reduce((s, r) => s + Number(r.total), 0);
  const physicalCogs = physicalSales.reduce((s, r) => s + Number(r.cogsTotal), 0);
  const physicalProfit = physicalSales.reduce((s, r) => s + Number(r.grossProfit), 0);

  // Club commissions for the month (only meaningful at month level, stored at 0 for daily)
  // Monthly commission aggregation happens in the clubs dashboard, not in daily snapshots.
  const clubCommissions = 0;

  const payload = {
    revenue: sum("total"),
    orders: orders.length,
    cogs: sum("cogsTotal"),
    shippingCost: sum("shippingCost"),
    fees: sum("paymentFees"),
    adSpend: sum("attributedAdSpend"),
    influencerCost: sum("influencerCost"),
    otherExpenses: Number(expenseAgg._sum.amount ?? 0),
    refunds: sum("refundedTotal"),
    grossProfit: sum("grossProfit"),
    netProfit: sum("netProfit"),
    customers: customerIds.size,
    newCustomers: newCount,
    physicalRevenue,
    physicalCogs,
    physicalProfit,
    clubCommissions,
    computedAt: new Date(),
  };

  await prisma.analyticsSnapshot.upsert({
    where: { storeId_date: { storeId, date: day } },
    update: payload,
    create: { storeId, date: day, ...payload },
  });
}

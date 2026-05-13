import { prisma } from "@/lib/prisma";

// Computes one day of rolled-up analytics for a store.
// Idempotent — overwrites the existing row for that date.

export async function computeAnalyticsSnapshot(storeId: string, dateISO: string) {
  const day = new Date(dateISO + "T00:00:00Z");
  const next = new Date(day);
  next.setUTCDate(next.getUTCDate() + 1);

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

  const expenseAgg = await prisma.expense.aggregate({
    where: { storeId, incurredOn: day },
    _sum: { amount: true },
  });

  const customerIds = new Set<string>();
  let newCount = 0;
  for (const o of orders) {
    if (o.customerId) customerIds.add(o.customerId);
    if (o.customer?.firstOrderAt && o.customer.firstOrderAt >= day && o.customer.firstOrderAt < next) {
      newCount++;
    }
  }

  await prisma.analyticsSnapshot.upsert({
    where: { storeId_date: { storeId, date: day } },
    update: {
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
      computedAt: new Date(),
    },
    create: {
      storeId,
      date: day,
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
    },
  });
}

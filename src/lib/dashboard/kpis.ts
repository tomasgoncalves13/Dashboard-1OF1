import { prisma } from "@/lib/prisma";

const PAID_STATUSES = ["PAID"];

export type KpiSet = {
  revenue: number;
  netProfit: number;
  cogs: number;
  fees: number;
  adSpend: number;
  ordersCount: number;
  aov: number;
  margin: number | null;
};

export async function getKpis(
  storeId: string,
  from: Date,
  to: Date,
  opts: { paidOnly: boolean },
): Promise<KpiSet> {
  const where = {
    storeId,
    processedAt: { gte: from, lte: to },
    ...(opts.paidOnly ? { financialStatus: { in: PAID_STATUSES } } : {}),
  };

  const [agg, ordersCount] = await Promise.all([
    prisma.order.aggregate({
      where,
      _sum: {
        total: true,
        cogsTotal: true,
        paymentFees: true,
        netProfit: true,
        attributedAdSpend: true,
      },
    }),
    prisma.order.count({ where }),
  ]);

  const revenue = Number(agg._sum.total ?? 0);
  const netProfit = Number(agg._sum.netProfit ?? 0);
  const cogs = Number(agg._sum.cogsTotal ?? 0);
  const fees = Number(agg._sum.paymentFees ?? 0);
  const adSpend = Number(agg._sum.attributedAdSpend ?? 0);

  return {
    revenue,
    netProfit,
    cogs,
    fees,
    adSpend,
    ordersCount,
    aov: ordersCount > 0 ? revenue / ordersCount : 0,
    margin: revenue > 0 ? (netProfit / revenue) * 100 : null,
  };
}

/** Sum of net payout amounts (Shopify Payments → bank) in the window. */
export async function getPayoutsTotal(storeId: string, from: Date, to: Date) {
  const agg = await prisma.payout.aggregate({
    where: {
      storeId,
      issuedAt: { gte: from, lte: to },
      status: { in: ["PAID", "IN_TRANSIT"] },
    },
    _sum: { net: true },
    _count: { _all: true },
  });
  return { total: Number(agg._sum.net ?? 0), count: agg._count._all };
}

export type GatewayRow = { gateway: string; orders: number; revenue: number };

/** Per-gateway revenue breakdown for PAID orders in the window. */
export async function getGatewayBreakdown(storeId: string, from: Date, to: Date): Promise<GatewayRow[]> {
  const rows = await prisma.order.groupBy({
    by: ["paymentGateway"],
    where: {
      storeId,
      processedAt: { gte: from, lte: to },
      financialStatus: "PAID",
    },
    _sum: { total: true },
    _count: { _all: true },
    orderBy: { _sum: { total: "desc" } },
  });
  return rows.map((r) => ({
    gateway: r.paymentGateway ?? "(sem gateway)",
    orders: r._count._all,
    revenue: Number(r._sum.total ?? 0),
  }));
}

/**
 * Eupago net transferred to bank in the window.
 * Prefers imported CSV payouts (real bank transfers); falls back to API
 * transactions when no payouts cover the period.
 */
export async function getEupagoNet(storeId: string, from: Date, to: Date) {
  const payoutAgg = await prisma.eupagoPayout.aggregate({
    where: {
      storeId,
      paymentDate: { gte: from, lte: to },
    },
    _sum: { netAmount: true, grossAmount: true, commission: true, iva: true },
    _count: { _all: true },
  });

  if (payoutAgg._count._all > 0) {
    const fees = Number(payoutAgg._sum.commission ?? 0) + Number(payoutAgg._sum.iva ?? 0);
    return {
      gross: Number(payoutAgg._sum.grossAmount ?? 0),
      fees,
      net: Number(payoutAgg._sum.netAmount ?? 0),
      count: payoutAgg._count._all,
      source: "PAYOUTS" as const,
    };
  }

  // Fallback: aggregate API transactions
  const txAgg = await prisma.eupagoTransaction.aggregate({
    where: {
      storeId,
      status: "Paga",
      datePayment: { gte: from, lte: to },
    },
    _sum: { amount: true, totalCommission: true, net: true },
    _count: { _all: true },
  });
  return {
    gross: Number(txAgg._sum.amount ?? 0),
    fees: Number(txAgg._sum.totalCommission ?? 0),
    net: Number(txAgg._sum.net ?? 0),
    count: txAgg._count._all,
    source: "TRANSACTIONS" as const,
  };
}

/**
 * Combined "money to bank" estimate for the window:
 * - Shopify Payments → actual payout.net
 * - Eupago → real net from Eupago API (gross - fees)
 * - All other gateways (PayPal, Stripe, manual) → order.total gross (no fee data)
 */
export async function getMoneyToBank(storeId: string, from: Date, to: Date) {
  const [payouts, eupago, othersAgg] = await Promise.all([
    getPayoutsTotal(storeId, from, to),
    getEupagoNet(storeId, from, to),
    prisma.order.aggregate({
      where: {
        storeId,
        processedAt: { gte: from, lte: to },
        financialStatus: "PAID",
        paymentGateway: { notIn: ["shopify_payments", "Eupago Payments Gateway"] },
      },
      _sum: { total: true },
    }),
  ]);
  const othersGross = Number(othersAgg._sum.total ?? 0);
  return {
    payoutsNet: payouts.total,
    payoutsCount: payouts.count,
    eupagoNet: eupago.net,
    eupagoFees: eupago.fees,
    eupagoCount: eupago.count,
    othersGross,
    total: payouts.total + eupago.net + othersGross,
  };
}

export type PhysicalKpiSet = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  salesCount: number;
  margin: number | null;
  byChannel: { channel: string; revenue: number; grossProfit: number; count: number }[];
};

export async function getPhysicalKpis(
  storeId: string,
  from: Date,
  to: Date,
): Promise<PhysicalKpiSet> {
  const [agg, byChannel] = await Promise.all([
    prisma.manualSale.aggregate({
      where: { storeId, soldAt: { gte: from, lte: to } },
      _sum: { total: true, cogsTotal: true, grossProfit: true },
      _count: { _all: true },
    }),
    prisma.manualSale.groupBy({
      by: ["channel"],
      where: { storeId, soldAt: { gte: from, lte: to } },
      _sum: { total: true, grossProfit: true },
      _count: { _all: true },
      orderBy: { _sum: { total: "desc" } },
    }),
  ]);
  const revenue = Number(agg._sum.total ?? 0);
  const grossProfit = Number(agg._sum.grossProfit ?? 0);
  return {
    revenue,
    cogs: Number(agg._sum.cogsTotal ?? 0),
    grossProfit,
    salesCount: agg._count._all,
    margin: revenue > 0 ? (grossProfit / revenue) * 100 : null,
    byChannel: byChannel.map((r) => ({
      channel: r.channel,
      revenue: Number(r._sum.total ?? 0),
      grossProfit: Number(r._sum.grossProfit ?? 0),
      count: r._count._all,
    })),
  };
}

export type MonthlyPnLRow = {
  month: string; // "YYYY-MM"
  ecomRevenue: number;
  ecomGrossProfit: number;
  ecomNetProfit: number;
  physRevenue: number;
  physGrossProfit: number;
  expenses: number;
  netProfit: number;
};

/**
 * Returns last `months` calendar months of combined P&L.
 * netProfit = ecomNetProfit + physGrossProfit − expenses
 * (ecomNetProfit already deducts COGS, packaging, payment fees, attributed ad spend)
 */
export async function getMonthlyPnL(storeId: string, months: number): Promise<MonthlyPnLRow[]> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  // Fetch all data in 3 queries, group by month in JS to avoid raw SQL column-name issues
  const [orders, physSales, expenses] = await Promise.all([
    prisma.order.findMany({
      where: { storeId, processedAt: { gte: from }, financialStatus: "PAID" },
      select: { processedAt: true, total: true, grossProfit: true, netProfit: true },
    }),
    prisma.manualSale.findMany({
      where: { storeId, soldAt: { gte: from } },
      select: { soldAt: true, total: true, grossProfit: true },
    }),
    prisma.expense.findMany({
      where: { storeId, incurredOn: { gte: from } },
      select: { incurredOn: true, amount: true },
    }),
  ]);

  function toMonth(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  const result: MonthlyPnLRow[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = toMonth(d);

    const mo = orders.filter((o) => toMonth(o.processedAt) === month);
    const mp = physSales.filter((s) => toMonth(s.soldAt) === month);
    const me = expenses.filter((e) => toMonth(new Date(e.incurredOn)) === month);

    const ecomRevenue = mo.reduce((s, o) => s + Number(o.total), 0);
    const ecomGrossProfit = mo.reduce((s, o) => s + Number(o.grossProfit), 0);
    const ecomNetProfit = mo.reduce((s, o) => s + Number(o.netProfit), 0);
    const physRevenue = mp.reduce((s, p) => s + Number(p.total), 0);
    const physGrossProfit = mp.reduce((s, p) => s + Number(p.grossProfit), 0);
    const expensesTotal = me.reduce((s, e) => s + Number(e.amount), 0);

    result.push({
      month,
      ecomRevenue,
      ecomGrossProfit,
      ecomNetProfit,
      physRevenue,
      physGrossProfit,
      expenses: expensesTotal,
      netProfit: ecomNetProfit + physGrossProfit - expensesTotal,
    });
  }
  return result;
}

export async function getDailyRevenue(
  storeId: string,
  from: Date,
  to: Date,
  opts: { paidOnly: boolean },
) {
  const statusFilter = opts.paidOnly
    ? prisma.$queryRawUnsafe<{ day: Date; revenue: number; net_profit: number }[]>(
        `select date_trunc('day', "processedAt") as day,
                sum("total")::float as revenue,
                sum("netProfit")::float as net_profit
         from "orders"
         where "storeId" = $1 and "processedAt" >= $2 and "processedAt" <= $3
           and "financialStatus" = ANY($4)
         group by 1 order by 1 asc`,
        storeId, from, to, PAID_STATUSES,
      )
    : prisma.$queryRawUnsafe<{ day: Date; revenue: number; net_profit: number }[]>(
        `select date_trunc('day', "processedAt") as day,
                sum("total")::float as revenue,
                sum("netProfit")::float as net_profit
         from "orders"
         where "storeId" = $1 and "processedAt" >= $2 and "processedAt" <= $3
         group by 1 order by 1 asc`,
        storeId, from, to,
      );
  return statusFilter;
}

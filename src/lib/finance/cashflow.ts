import { prisma } from "@/lib/prisma";
import { getPhysicalKpis, getEupagoNet } from "@/lib/dashboard/kpis";
import { getAdAccountInsights } from "@/lib/meta/graph";
import { getAdAccountInsights as getGoogleAdAccountInsights } from "@/lib/google-ads/client";
import { ymd } from "@/lib/dashboard/range";

export type CashflowEntry = {
  date: Date;
  type: "IN" | "OUT";
  source: string;
  description: string;
  amount: number;
  net: number;
};

export type MonthlyCashflow = {
  month: string; // "2025-01"
  cashIn: number;
  cashOut: number;
  net: number;
};

export async function getCashflowEntries(
  storeId: string,
  from: Date,
  to: Date,
): Promise<CashflowEntry[]> {
  const entries: CashflowEntry[] = [];

  // Cash IN: Shopify payouts
  const payouts = await prisma.payout.findMany({
    where: { storeId, issuedAt: { gte: from, lte: to }, status: { in: ["PAID", "IN_TRANSIT"] } },
    orderBy: { issuedAt: "asc" },
  });
  for (const p of payouts) {
    entries.push({
      date: p.issuedAt,
      type: "IN",
      source: "Shopify Payments",
      description: `Payout ${p.shopifyId}`,
      amount: Number(p.chargesGross),
      net: Number(p.net),
    });
  }

  // Cash IN: Eupago payouts (CSV import), falling back to raw API transactions when no payout covers the period
  const eupagoPayouts = await prisma.eupagoPayout.findMany({
    where: { storeId, paymentDate: { gte: from, lte: to } },
    orderBy: { paymentDate: "asc" },
  });
  if (eupagoPayouts.length > 0) {
    for (const ep of eupagoPayouts) {
      entries.push({
        date: ep.paymentDate,
        type: "IN",
        source: "Eupago",
        description: `Transferência ${ep.fileRef}`,
        amount: Number(ep.grossAmount),
        net: Number(ep.netAmount),
      });
    }
  } else {
    const eupagoTransactions = await prisma.eupagoTransaction.findMany({
      where: { storeId, status: "Paga", datePayment: { gte: from, lte: to } },
      orderBy: { datePayment: "asc" },
    });
    for (const et of eupagoTransactions) {
      entries.push({
        date: et.datePayment,
        type: "IN",
        source: "Eupago",
        description: `Transação ${et.trid}`,
        amount: Number(et.amount),
        net: Number(et.net),
      });
    }
  }

  // Cash OUT: Expenses
  const expenses = await prisma.expense.findMany({
    where: { storeId, incurredOn: { gte: from, lte: to } },
    orderBy: { incurredOn: "asc" },
  });
  for (const e of expenses) {
    entries.push({
      date: e.incurredOn,
      type: "OUT",
      source: `Despesa — ${e.category}`,
      description: e.description ?? e.vendor ?? e.category,
      amount: Number(e.amount),
      net: -Number(e.amount),
    });
  }

  // Cash OUT: Influencer payments
  const influencerPayments = await prisma.influencerPayment.findMany({
    where: { influencer: { storeId }, paidAt: { gte: from, lte: to } },
    include: { influencer: { select: { name: true } } },
    orderBy: { paidAt: "asc" },
  });
  for (const ip of influencerPayments) {
    entries.push({
      date: ip.paidAt,
      type: "OUT",
      source: "Influencer",
      description: ip.influencer.name,
      amount: Number(ip.amount),
      net: -Number(ip.amount),
    });
  }

  return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function getMonthlyCashflow(
  storeId: string,
  months: number = 6,
): Promise<MonthlyCashflow[]> {
  const result: MonthlyCashflow[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const from = d;
    const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));

    const [payoutAgg, eupagoNet, expenseAgg, influencerAgg] = await Promise.all([
      prisma.payout.aggregate({
        where: { storeId, issuedAt: { gte: from, lt: to }, status: { in: ["PAID", "IN_TRANSIT"] } },
        _sum: { net: true },
      }),
      getEupagoNet(storeId, from, to),
      prisma.expense.aggregate({
        where: { storeId, incurredOn: { gte: from, lt: to } },
        _sum: { amount: true },
      }),
      prisma.influencerPayment.aggregate({
        where: { influencer: { storeId }, paidAt: { gte: from, lt: to } },
        _sum: { amount: true },
      }),
    ]);

    const cashIn =
      Number(payoutAgg._sum.net ?? 0) + eupagoNet.net;
    const cashOut =
      Number(expenseAgg._sum.amount ?? 0) + Number(influencerAgg._sum.amount ?? 0);

    result.push({
      month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      cashIn,
      cashOut,
      net: cashIn - cashOut,
    });
  }

  return result;
}

export type FinanceBreakdown = {
  physicalRevenue: number;
  onlineRevenue: number; // Shopify Payments + Eupago net
  cashIn: number;

  physicalCost: number; // COGS + club commission
  onlineOrderCost: number; // COGS + packaging + payment fees + shipping
  facebookAdsCost: number;
  googleAdsCost: number;
  monthlyExpensesCost: number; // recurring expenses (Shopify, software, academia, etc)
  shippingExpensesCost: number; // manual SHIPPING-category expenses
  influencerCost: number;
  otherExpensesCost: number; // everything else not covered above
  cashOut: number;

  netCashflow: number;
};

/** Full revenue/cost breakdown for Finance — covers physical sales, online sales, and every cost stream. */
export async function getFinanceBreakdown(storeId: string, from: Date, to: Date): Promise<FinanceBreakdown> {
  const [
    physicalKpis,
    payoutAgg,
    eupagoNet,
    onlineOrderAgg,
    adsInsight,
    googleAdsInsight,
    recurringAgg,
    shippingAgg,
    otherAgg,
    influencerAgg,
  ] = await Promise.all([
    getPhysicalKpis(storeId, from, to),
    prisma.payout.aggregate({
      where: { storeId, issuedAt: { gte: from, lte: to }, status: { in: ["PAID", "IN_TRANSIT"] } },
      _sum: { net: true },
    }),
    getEupagoNet(storeId, from, to),
    prisma.order.aggregate({
      where: { storeId, processedAt: { gte: from, lte: to }, financialStatus: "PAID" },
      _sum: { cogsTotal: true, packagingCost: true, paymentFees: true, shippingCost: true },
    }),
    getAdAccountInsights(ymd(from), ymd(to)).catch(() => null),
    getGoogleAdAccountInsights(ymd(from), ymd(to)).catch(() => null),
    prisma.expense.aggregate({
      where: { storeId, incurredOn: { gte: from, lte: to }, recurring: true },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { storeId, incurredOn: { gte: from, lte: to }, recurring: false, category: "SHIPPING" },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { storeId, incurredOn: { gte: from, lte: to }, recurring: false, category: { not: "SHIPPING" } },
      _sum: { amount: true },
    }),
    prisma.influencerPayment.aggregate({
      where: { influencer: { storeId }, paidAt: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
  ]);

  const physicalRevenue = physicalKpis.revenue;
  const onlineRevenue = Number(payoutAgg._sum.net ?? 0) + eupagoNet.net;
  const cashIn = physicalRevenue + onlineRevenue;

  const physicalCost = physicalKpis.cogs + physicalKpis.commission;
  const onlineOrderCost =
    Number(onlineOrderAgg._sum.cogsTotal ?? 0) +
    Number(onlineOrderAgg._sum.packagingCost ?? 0) +
    Number(onlineOrderAgg._sum.paymentFees ?? 0) +
    Number(onlineOrderAgg._sum.shippingCost ?? 0);
  const facebookAdsCost = Number(adsInsight?.spend ?? 0);
  const googleAdsCost = Number(googleAdsInsight?.spend ?? 0);
  const monthlyExpensesCost = Number(recurringAgg._sum.amount ?? 0);
  const shippingExpensesCost = Number(shippingAgg._sum.amount ?? 0);
  const otherExpensesCost = Number(otherAgg._sum.amount ?? 0);
  const influencerCost = Number(influencerAgg._sum.amount ?? 0);

  const cashOut =
    physicalCost + onlineOrderCost + facebookAdsCost + googleAdsCost + monthlyExpensesCost +
    shippingExpensesCost + influencerCost + otherExpensesCost;

  return {
    physicalRevenue,
    onlineRevenue,
    cashIn,
    physicalCost,
    onlineOrderCost,
    facebookAdsCost,
    googleAdsCost,
    monthlyExpensesCost,
    shippingExpensesCost,
    influencerCost,
    otherExpensesCost,
    cashOut,
    netCashflow: cashIn - cashOut,
  };
}

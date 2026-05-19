import { prisma } from "@/lib/prisma";

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

  // Cash IN: Eupago payouts
  const eupagoPayouts = await prisma.eupagoPayout.findMany({
    where: { storeId, paymentDate: { gte: from, lte: to } },
    orderBy: { paymentDate: "asc" },
  });
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

    const [payoutAgg, eupagoAgg, expenseAgg, influencerAgg] = await Promise.all([
      prisma.payout.aggregate({
        where: { storeId, issuedAt: { gte: from, lt: to }, status: { in: ["PAID", "IN_TRANSIT"] } },
        _sum: { net: true },
      }),
      prisma.eupagoPayout.aggregate({
        where: { storeId, paymentDate: { gte: from, lt: to } },
        _sum: { netAmount: true },
      }),
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
      Number(payoutAgg._sum.net ?? 0) + Number(eupagoAgg._sum.netAmount ?? 0);
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

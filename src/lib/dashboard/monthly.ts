import { prisma } from "@/lib/prisma";
import { calcClubCommission } from "@/lib/clubs/commission";

// Visão mensal desde o início (página /visao-mensal): encomendas do site pagas (inclui as reembolsadas, como o
// Shopify conta), vendas físicas, gasto Meta, despesas e compras de stock, para ver em que meses se ganha ou perde.
// "Lucro" conta o custo das peças vendidas; "Dinheiro real" conta antes o stock comprado, no mês em que se pagou.
export type MonthSummary = {
  month: string; // "2026-09"
  orders: number;
  gross: number; // total cobrado, com envio
  shipping: number;
  discounts: number;
  refunds: number;
  over40: number; // encomendas com subtotal ≥ €40
  cogs: number; // custo do produto das encomendas do site
  orderCosts: number; // produto + embalagem + comissões de pagamento + envio (profit engine)
  adSpend: number; // gasto Meta Ads (ad_metrics)
  metaPurchases: number; // compras atribuídas pela Meta
  physicalRevenue: number; // vendas a clubes e em mão
  physicalCogs: number;
  physicalCommission: number; // comissões dos clubes (por mês e por clube, por escalões)
  fixedExpenses: number; // despesas recorrentes, sem a Academia Ecommerce
  otherExpenses: number; // despesas pontuais (sem a Academia)
  academia: number; // Academia Ecommerce: fora do lucro do mês, só aparece à parte nos cards
  stockPurchases: number; // encomendas a fornecedores (/encomendas), no mês do pagamento
  products: { title: string; qty: number; revenue: number; variants: { title: string; qty: number; revenue: number }[] }[];
};

// Lucro do mês = vendas − custo das peças vendidas − custos das encomendas − ads − despesas (sem a Academia).
export const monthProfit = (m: MonthSummary) =>
  m.gross - m.refunds - m.orderCosts - m.adSpend - m.fixedExpenses - m.otherExpenses +
  m.physicalRevenue - m.physicalCogs - m.physicalCommission;

// Dinheiro real = igual, mas em vez do custo das peças vendidas conta o stock comprado nesse mês.
export const monthCash = (m: MonthSummary) => monthProfit(m) + m.cogs + m.physicalCogs - m.stockPurchases;

const emptyMonth = (month: string) => ({
  month, orders: 0, gross: 0, shipping: 0, discounts: 0, refunds: 0, over40: 0, cogs: 0, orderCosts: 0, adSpend: 0, metaPurchases: 0,
  physicalRevenue: 0, physicalCogs: 0, physicalCommission: 0, fixedExpenses: 0, otherExpenses: 0, academia: 0, stockPurchases: 0,
  products: [], map: new Map<string, { qty: number; revenue: number; v: Map<string, { qty: number; revenue: number }> }>(),
});

export async function getMonthlyOverview(storeId: string): Promise<MonthSummary[]> {
  const [orders, adDays, expenses, sales, clubs, purchases] = await Promise.all([
    prisma.order.findMany({
      where: { storeId, channel: "SHOPIFY", financialStatus: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] }, cancelledAt: null },
      select: {
        processedAt: true, total: true, subtotal: true, shippingCharged: true, discountTotal: true, refundedTotal: true,
        cogsTotal: true, packagingCost: true, paymentFees: true, shippingCost: true,
        items: { select: { title: true, quantity: true, totalRevenue: true, variant: { select: { title: true, product: { select: { title: true } } } } } },
      },
      orderBy: { processedAt: "asc" },
    }),
    prisma.adMetric.groupBy({
      by: ["date"],
      where: { campaign: { storeId, provider: "META" } },
      _sum: { spend: true, purchases: true },
    }),
    prisma.expense.findMany({
      where: { storeId, incurredOn: { lte: new Date() } },
      select: { incurredOn: true, amount: true, recurring: true, vendor: true },
    }),
    prisma.manualSale.findMany({ where: { storeId }, select: { soldAt: true, clubId: true, total: true, cogsTotal: true } }),
    prisma.club.findMany({ where: { storeId }, select: { id: true, commissionEnabled: true, commissionTiers: true } }),
    prisma.purchaseOrder.findMany({ where: { storeId }, select: { date: true, totalCost: true } }),
  ]);
  const monthOf = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit" });
  const byMonth = new Map<string, ReturnType<typeof emptyMonth>>();
  const get = (key: string) => {
    let m = byMonth.get(key);
    if (!m) byMonth.set(key, (m = emptyMonth(key)));
    return m;
  };
  for (const o of orders) {
    const m = get(monthOf.format(o.processedAt).slice(0, 7));
    m.orders++;
    m.gross += Number(o.total);
    m.shipping += Number(o.shippingCharged);
    m.discounts += Number(o.discountTotal);
    m.refunds += Number(o.refundedTotal);
    m.cogs += Number(o.cogsTotal);
    m.orderCosts += Number(o.cogsTotal) + Number(o.packagingCost) + Number(o.paymentFees) + Number(o.shippingCost);
    if (Number(o.subtotal) >= 40) m.over40++;
    for (const it of o.items) {
      const pt = it.variant?.product.title ?? it.title;
      const vt = it.variant?.title ?? "—";
      let p = m.map.get(pt);
      if (!p) m.map.set(pt, (p = { qty: 0, revenue: 0, v: new Map() }));
      p.qty += it.quantity;
      p.revenue += Number(it.totalRevenue);
      const v = p.v.get(vt) ?? { qty: 0, revenue: 0 };
      v.qty += it.quantity;
      v.revenue += Number(it.totalRevenue);
      p.v.set(vt, v);
    }
  }
  for (const d of adDays) {
    const m = get(d.date.toISOString().slice(0, 7));
    m.adSpend += Number(d._sum.spend ?? 0);
    m.metaPurchases += d._sum.purchases ?? 0;
  }
  for (const e of expenses) {
    const m = get(e.incurredOn.toISOString().slice(0, 7));
    if (e.vendor === "Academia Ecommerce") m.academia += Number(e.amount);
    else if (e.recurring) m.fixedExpenses += Number(e.amount);
    else m.otherExpenses += Number(e.amount);
  }
  for (const po of purchases) get(po.date.toISOString().slice(0, 7)).stockPurchases += Number(po.totalCost);

  // comissão por clube e por mês (escalões progressivos sobre a faturação do mês)
  const clubMonth = new Map<string, number>();
  for (const s of sales) {
    const key = monthOf.format(s.soldAt).slice(0, 7);
    const m = get(key);
    m.physicalRevenue += Number(s.total);
    m.physicalCogs += Number(s.cogsTotal);
    if (s.clubId) clubMonth.set(`${key}|${s.clubId}`, (clubMonth.get(`${key}|${s.clubId}`) ?? 0) + Number(s.total));
  }
  for (const [k, revenue] of clubMonth) {
    const [key, clubId] = k.split("|");
    const club = clubs.find((c) => c.id === clubId);
    if (club) get(key).physicalCommission += calcClubCommission(revenue, club.commissionEnabled, club.commissionTiers);
  }

  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).map(({ map, ...m }) => ({
    ...m,
    products: [...map.entries()]
      .map(([title, p]) => ({ title, qty: p.qty, revenue: p.revenue, variants: [...p.v.entries()].map(([t, v]) => ({ title: t, ...v })).sort((a, b) => b.qty - a.qty) }))
      .sort((a, b) => b.qty - a.qty),
  }));
}

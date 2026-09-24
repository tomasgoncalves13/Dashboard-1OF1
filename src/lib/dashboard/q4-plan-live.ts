import { prisma } from "@/lib/prisma";

// Dados reais para o simulador do Plano Q4 (src/lib/dashboard/plano-q4.html):
// stock por item físico, consumo do site desde que os ads arrancaram e vendas a clubes.
const ADS_START = new Date("2026-09-09T00:00:00Z");
const DAY = 86_400_000;

export type Q4PlanLive = {
  today: string;
  sampleOrders: number;
  ordersPerDay: number;
  items: Record<string, { stock: number; site: number; club: number }>;
  months: MonthSummary[];
};

// Visão mensal desde o início: encomendas do site pagas (inclui as reembolsadas, como o Shopify conta),
// gasto Meta guardado na base de dados e despesas fixas, para ver em que meses se ganha ou perde dinheiro.
type MonthSummary = {
  month: string; // "2026-09"
  orders: number;
  gross: number; // total cobrado, com envio
  shipping: number;
  discounts: number;
  refunds: number;
  over40: number; // encomendas com subtotal ≥ €40
  orderCosts: number; // produto + embalagem + comissões de pagamento + envio (profit engine)
  adSpend: number; // gasto Meta Ads (ad_metrics)
  metaPurchases: number; // compras atribuídas pela Meta
  fixedExpenses: number; // despesas recorrentes, sem a Academia Ecommerce (como o "Lucro Site" das Finanças)
  products: { title: string; qty: number; revenue: number; variants: { title: string; qty: number; revenue: number }[] }[];
};

const emptyMonth = (month: string) => ({
  month, orders: 0, gross: 0, shipping: 0, discounts: 0, refunds: 0, over40: 0, orderCosts: 0, adSpend: 0, metaPurchases: 0, fixedExpenses: 0,
  products: [], map: new Map<string, { qty: number; revenue: number; v: Map<string, { qty: number; revenue: number }> }>(),
});

async function getMonths(storeId: string): Promise<MonthSummary[]> {
  const [orders, adDays, expenses] = await Promise.all([
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
      where: { storeId, recurring: true, vendor: { not: "Academia Ecommerce" }, incurredOn: { lte: new Date() } },
      select: { incurredOn: true, amount: true },
    }),
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
  // despesas fixas só a partir do primeiro mês com vendas ou anúncios
  const first = [...byMonth.keys()].sort()[0];
  for (const e of expenses) {
    const key = e.incurredOn.toISOString().slice(0, 7);
    if (first && key >= first) get(key).fixedExpenses += Number(e.amount);
  }

  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).map(({ map, ...m }) => ({
    ...m,
    products: [...map.entries()]
      .map(([title, p]) => ({ title, qty: p.qty, revenue: p.revenue, variants: [...p.v.entries()].map(([t, v]) => ({ title: t, ...v })).sort((a, b) => b.qty - a.qty) }))
      .sort((a, b) => b.qty - a.qty),
  }));
}

export async function getQ4PlanLive(storeId: string): Promise<Q4PlanLive> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());

  const orders = await prisma.order.findMany({
    where: {
      storeId,
      channel: "SHOPIFY",
      processedAt: { gte: ADS_START },
      financialStatus: { in: ["PAID", "PARTIALLY_REFUNDED"] },
      cancelledAt: null,
    },
    select: { shopifyId: true },
  });
  const orderIds = orders.map((o) => o.shopifyId).filter((id): id is string => !!id);

  const [items, site, club, months] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { storeId }, select: { id: true, code: true, stockOnHand: true } }),
    prisma.stockMovement.groupBy({
      by: ["inventoryItemId"],
      where: { storeId, type: "SHOPIFY_SALE", reference: { in: orderIds }, inventoryItemId: { not: null } },
      _sum: { quantity: true },
    }),
    prisma.stockMovement.groupBy({
      by: ["inventoryItemId"],
      where: { storeId, type: "CLUB_SALE", inventoryItemId: { not: null } },
      _sum: { quantity: true },
    }),
    getMonths(storeId),
  ]);

  const sold = (rows: typeof site, id: string) => -(rows.find((r) => r.inventoryItemId === id)?._sum.quantity ?? 0);
  const days = Math.max(1, Math.round((Date.parse(today) - ADS_START.getTime()) / DAY) + 1);

  return {
    today,
    sampleOrders: orders.length,
    ordersPerDay: Math.round((orders.length / days) * 10) / 10,
    items: Object.fromEntries(
      items.map((i) => [i.code, { stock: i.stockOnHand, site: sold(site, i.id), club: sold(club, i.id) }]),
    ),
    months,
  };
}

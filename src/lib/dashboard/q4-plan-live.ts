import { prisma } from "@/lib/prisma";
import { getAdSpendMonthly } from "@/lib/meta/graph";

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

// Visão mensal desde o início: encomendas do site pagas (inclui as reembolsadas, como o Shopify conta).
type MonthSummary = {
  month: string; // "2026-09"
  orders: number;
  gross: number; // total cobrado, com envio
  shipping: number;
  discounts: number;
  refunds: number;
  over40: number; // encomendas com subtotal ≥ €40
  adSpend: number | null; // gasto na conta de anúncios Meta (null = API indisponível)
  metaPurchases: number; // compras atribuídas pela Meta
  products: { title: string; qty: number; revenue: number; variants: { title: string; qty: number; revenue: number }[] }[];
};

async function getMonths(storeId: string): Promise<MonthSummary[]> {
  const orders = await prisma.order.findMany({
    where: { storeId, channel: "SHOPIFY", financialStatus: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] }, cancelledAt: null },
    select: {
      processedAt: true, total: true, subtotal: true, shippingCharged: true, discountTotal: true, refundedTotal: true,
      items: { select: { title: true, quantity: true, totalRevenue: true, variant: { select: { title: true, product: { select: { title: true } } } } } },
    },
    orderBy: { processedAt: "asc" },
  });
  const monthOf = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit" });
  const byMonth = new Map<string, MonthSummary & { map: Map<string, { qty: number; revenue: number; v: Map<string, { qty: number; revenue: number }> }> }>();
  for (const o of orders) {
    const key = monthOf.format(o.processedAt).slice(0, 7);
    let m = byMonth.get(key);
    if (!m) byMonth.set(key, (m = { month: key, orders: 0, gross: 0, shipping: 0, discounts: 0, refunds: 0, over40: 0, adSpend: 0, metaPurchases: 0, products: [], map: new Map() }));
    m.orders++;
    m.gross += Number(o.total);
    m.shipping += Number(o.shippingCharged);
    m.discounts += Number(o.discountTotal);
    m.refunds += Number(o.refundedTotal);
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
  // Gasto em anúncios Meta por mês, direto da conta de anúncios
  const ads = new Map<string, { spend: number; purchases: number }>();
  let adsOk = true;
  try {
    const first = orders[0]?.processedAt.toISOString().slice(0, 7) ?? "2025-07";
    for (const r of await getAdSpendMonthly(`${first}-01`, new Date().toISOString().slice(0, 10))) {
      const purchases = Number(r.actions?.find((a) => a.action_type === "purchase")?.value ?? 0);
      ads.set(r.date_start.slice(0, 7), { spend: Number(r.spend), purchases });
    }
  } catch {
    adsOk = false;
  }
  for (const key of ads.keys()) {
    if (!byMonth.has(key)) byMonth.set(key, { month: key, orders: 0, gross: 0, shipping: 0, discounts: 0, refunds: 0, over40: 0, adSpend: 0, metaPurchases: 0, products: [], map: new Map() });
  }

  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).map(({ map, ...m }) => ({
    ...m,
    adSpend: adsOk ? (ads.get(m.month)?.spend ?? 0) : null,
    metaPurchases: ads.get(m.month)?.purchases ?? 0,
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

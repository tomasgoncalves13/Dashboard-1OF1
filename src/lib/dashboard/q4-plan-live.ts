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
};

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

  const [items, site, club] = await Promise.all([
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
  };
}

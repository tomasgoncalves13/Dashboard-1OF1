import { prisma } from "@/lib/prisma";

// Dados reais para o simulador do Plano Q4 (src/lib/dashboard/plano-q4.html):
// stock por item físico, consumo do site desde que os ads arrancaram e vendas a clubes.
const ADS_START = new Date("2026-09-09T00:00:00Z");
const DAY = 86_400_000;

// Tamanho físico certo de cada variante de Caneleiras Embutidas (26 Set 2026): a criança tem manga
// de criança em S (10x6), KM (12x6) e KL (14x6). Os movimentos de stock antigos põem o Criança Médio no M,
// por isso o consumo do site destas caneleiras sai das variantes vendidas e não dos movimentos.
function builtInCode(product: string, variant: string): string | null {
  if (!product.includes("Embutidas")) return null;
  const t = `${product} ${variant}`;
  const size = /Pequeno|MINI/.test(t) ? 0 : /Médio|MIDI/.test(t) ? 1 : /Grande|MAXI/.test(t) ? 2 : null;
  if (size === null) return null;
  return `BUILTIN-${(t.includes("Criança") ? ["S", "KM", "KL"] : ["M", "L", "XL"])[size]}`;
}

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
    select: { id: true, shopifyId: true },
  });
  const orderIds = orders.map((o) => o.shopifyId).filter((id): id is string => !!id);

  const [items, site, club, builtInLines] = await Promise.all([
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
    prisma.orderItem.findMany({
      where: { orderId: { in: orders.map((o) => o.id) }, variant: { product: { title: { contains: "Embutidas" } } } },
      select: { quantity: true, variant: { select: { title: true, product: { select: { title: true } } } } },
    }),
  ]);

  const builtInSite: Record<string, number> = { "BUILTIN-S": 0, "BUILTIN-KM": 0, "BUILTIN-KL": 0, "BUILTIN-M": 0, "BUILTIN-L": 0, "BUILTIN-XL": 0 };
  for (const l of builtInLines) {
    const code = l.variant && builtInCode(l.variant.product.title, l.variant.title);
    if (code) builtInSite[code] += l.quantity;
  }

  const sold = (rows: typeof site, id: string) => -(rows.find((r) => r.inventoryItemId === id)?._sum.quantity ?? 0);
  const days = Math.max(1, Math.round((Date.parse(today) - ADS_START.getTime()) / DAY) + 1);

  return {
    today,
    sampleOrders: orders.length,
    ordersPerDay: Math.round((orders.length / days) * 10) / 10,
    items: Object.fromEntries(
      items.map((i) => [
        i.code,
        { stock: i.stockOnHand, site: builtInSite[i.code] ?? sold(site, i.id), club: sold(club, i.id) },
      ]),
    ),
  };
}

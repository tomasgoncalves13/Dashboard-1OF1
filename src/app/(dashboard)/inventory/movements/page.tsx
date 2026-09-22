import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { resolveRange } from "@/lib/dashboard/range";
import { InventoryTabs } from "../inventory-tabs";
import { groupOf, shortName, GROUP_ORDER, groupLabel, type InventoryItemLite } from "@/lib/inventory/grouping";

type ItemAgg = {
  itemId: string;
  item: InventoryItemLite;
  stockOnHand: number;
  reorderPoint: number | null;
  site: number;
  physical: number;
  outro: number;
  bySource: Map<string, number>;
};

function stockColor(stockOnHand: number, reorderPoint: number | null) {
  if (stockOnHand <= 0) return "text-destructive border-destructive/30 bg-destructive/10";
  if (reorderPoint !== null && stockOnHand <= reorderPoint) return "text-amber-600 border-amber-500/30 bg-amber-500/10";
  return "text-emerald-600 border-emerald-500/30 bg-emerald-500/10";
}

export default async function InventoryMovementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const range = resolveRange(sp);

  const user = await getSessionUser();
  const store = user ? await prisma.store.findFirst({ where: { ownerId: user.id } }) : null;
  if (!store) return null;

  const items = await prisma.inventoryItem.findMany({
    where: { storeId: store.id },
    select: { id: true, name: true, family: true, stockOnHand: true, reorderPoint: true },
  });
  const itemById = new Map(items.map((i) => [i.id, i]));

  const siteOrderCount = await prisma.order.count({
    where: { storeId: store.id, processedAt: { gte: range.from, lte: range.to } },
  });

  // Só o consumo real por item físico (StockMovement), não as unidades de
  // produto/variante vendidas — um "Pack Pro" vende 1 variante mas consome
  // 1 caneleira + 6 meias + 2 sock sleeves via BOM (VariantComponent), e é
  // esse consumo real que interessa aqui.
  const movements = await prisma.stockMovement.findMany({
    where: {
      storeId: store.id,
      inventoryItemId: { not: null },
      createdAt: { gte: range.from, lte: range.to },
      quantity: { lt: 0 },
    },
    select: { inventoryItemId: true, type: true, quantity: true, reference: true },
  });

  const manualSaleIds = [
    ...new Set(
      movements
        .filter((m) => m.type === "CLUB_SALE" || m.type === "MANUAL_SALE")
        .map((m) => m.reference)
        .filter((r): r is string => !!r),
    ),
  ];
  const sales = manualSaleIds.length
    ? await prisma.manualSale.findMany({
        where: { id: { in: manualSaleIds } },
        select: { id: true, channel: true, club: { select: { name: true } } },
      })
    : [];
  const saleById = new Map(sales.map((s) => [s.id, s]));

  // Começa com TODOS os itens a 0 — mesmo o que não teve nenhuma saída no
  // período deve aparecer (com "-0"), não só os que tiveram movimento.
  const agg = new Map<string, ItemAgg>(
    items.map((item) => [
      item.id,
      {
        itemId: item.id,
        item,
        stockOnHand: item.stockOnHand,
        reorderPoint: item.reorderPoint,
        site: 0,
        physical: 0,
        outro: 0,
        bySource: new Map(),
      },
    ]),
  );
  const getEntry = (itemId: string) => agg.get(itemId) ?? null;

  for (const m of movements) {
    if (!m.inventoryItemId) continue;
    const entry = getEntry(m.inventoryItemId);
    if (!entry) continue;
    const qty = -m.quantity; // unidades que saíram (positivo)

    if (m.type === "SHOPIFY_SALE") {
      entry.site += qty;
    } else if (m.type === "CLUB_SALE" || m.type === "MANUAL_SALE") {
      entry.physical += qty;
      const sale = m.reference ? saleById.get(m.reference) : null;
      const source = sale?.channel === "CLUB" ? (sale.club?.name ?? "Clube") : "Venda normal";
      entry.bySource.set(source, (entry.bySource.get(source) ?? 0) + qty);
    } else {
      entry.outro += qty;
    }
  }

  const byFamily = GROUP_ORDER
    .map((family) => ({
      family,
      entries: [...agg.values()]
        .filter((e) => groupOf(e.item) === family)
        .sort((a, b) => b.site + b.physical + b.outro - (a.site + a.physical + a.outro)),
    }))
    .filter((g) => g.entries.length > 0);

  const totalUnits = [...agg.values()].reduce((s, e) => s + e.site + e.physical + e.outro, 0);
  const totalClubUnits = [...agg.values()].reduce((s, e) => s + e.physical, 0);

  return (
    <div className="space-y-6">
      <InventoryTabs />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Movimentos de Inventário</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{totalUnits} produtos saíram</span>
            {" · "}
            <span className="font-medium text-foreground">{siteOrderCount} encomendas no site</span>
            {" · "}
            <span className="font-medium text-foreground">{totalClubUnits} produtos vendidos em clubes</span>
            {" · "}{range.label}
          </p>
        </div>
        <DateRangePicker active={range.preset} />
      </div>

      {byFamily.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Sem movimentos de saída no período selecionado.
        </Card>
      ) : (
        byFamily.map(({ family, entries }) => {
          const famTotal = entries.reduce((s, e) => s + e.site + e.physical + e.outro, 0);
          const famSite = entries.reduce((s, e) => s + e.site, 0);
          const famPhysical = entries.reduce((s, e) => s + e.physical, 0);
          return (
            <Card key={family}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center gap-4">
                  <CardTitle className="text-foreground text-xl">{groupLabel(family)}</CardTitle>
                  <div className="flex items-baseline gap-3">
                    {famTotal > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Site {famSite} · Clubes {famPhysical}
                      </span>
                    )}
                    <span
                      className={`text-2xl font-bold tabular-nums leading-none ${famTotal > 0 ? "text-destructive" : "text-muted-foreground/50"}`}
                    >
                      -{famTotal}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {entries.map((e) => {
                  const total = e.site + e.physical + e.outro;
                  const sources = [...e.bySource.entries()].sort((a, b) => b[1] - a[1]);
                  return (
                    <div
                      key={e.itemId}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border bg-muted/20 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`text-2xl font-bold tabular-nums leading-none shrink-0 ${
                            total > 0 ? "text-destructive" : "text-muted-foreground/50"
                          }`}
                        >
                          -{total}
                        </span>
                        <span className="text-base font-semibold truncate">{shortName(e.item)}</span>
                        <span
                          className={`text-xs font-medium tabular-nums border rounded-full px-2 py-1 shrink-0 ${stockColor(e.stockOnHand, e.reorderPoint)}`}
                        >
                          {e.stockOnHand} em stock
                        </span>
                      </div>
                      {total > 0 ? (
                        <div className="text-xs text-muted-foreground text-right leading-relaxed">
                          <span className="font-medium text-foreground">Site {e.site}</span>
                          {e.physical > 0 && (
                            <>
                              {" · "}
                              <span className="font-medium text-foreground">Clubes {e.physical}</span>
                              {sources.length > 0 && (
                                <span className="text-muted-foreground"> ({sources.map(([name, qty]) => `${name} ${qty}`).join(" · ")})</span>
                              )}
                            </>
                          )}
                          {e.outro > 0 && <> · Outro {e.outro}</>}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground/50">Sem vendas no período</div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { resolveRange } from "@/lib/dashboard/range";
import { InventoryTabs } from "../inventory-tabs";
import { groupOf, shortName, GROUP_ORDER, type InventoryItemLite } from "@/lib/inventory/grouping";

type ItemAgg = {
  itemId: string;
  item: InventoryItemLite;
  stockOnHand: number;
  site: number;
  physical: number;
  outro: number;
  bySource: Map<string, number>;
};

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
    select: { id: true, name: true, family: true, stockOnHand: true },
  });
  const itemById = new Map(items.map((i) => [i.id, i]));

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

  const agg = new Map<string, ItemAgg>();
  const getEntry = (itemId: string) => {
    let entry = agg.get(itemId);
    if (!entry) {
      const item = itemById.get(itemId);
      if (!item) return null;
      entry = { itemId, item, stockOnHand: item.stockOnHand, site: 0, physical: 0, outro: 0, bySource: new Map() };
      agg.set(itemId, entry);
    }
    return entry;
  };

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
        .filter((e) => groupOf(e.item) === family && e.site + e.physical + e.outro > 0)
        .sort((a, b) => b.site + b.physical + b.outro - (a.site + a.physical + a.outro)),
    }))
    .filter((g) => g.entries.length > 0);

  return (
    <div className="space-y-6">
      <InventoryTabs />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Movimentos de Inventário</h1>
          <p className="text-sm text-muted-foreground">
            Consumo real de stock por item físico (já decompõe packs/bundles no que realmente saiu) · {range.label}
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
          return (
            <Card key={family}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-baseline">
                  <CardTitle className="text-foreground text-xl">{family}</CardTitle>
                  <div className="text-base font-semibold text-destructive tabular-nums">-{famTotal}</div>
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
                        <span className="text-2xl font-bold text-destructive tabular-nums leading-none shrink-0">
                          -{total}
                        </span>
                        <span className="text-base font-semibold truncate">{shortName(e.item)}</span>
                        <span className="text-xs font-medium text-muted-foreground tabular-nums bg-background border rounded-full px-2 py-1 shrink-0">
                          {e.stockOnHand} em stock
                        </span>
                      </div>
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

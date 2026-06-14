import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StockAdjustDialog } from "./stock-adjust-dialog";

export default async function InventoryPage() {
  const user = await getSessionUser();
  const store = user ? await prisma.store.findFirst({ where: { ownerId: user.id } }) : null;
  if (!store) return null;

  const items = await prisma.inventoryItem.findMany({
    where: { storeId: store.id },
    orderBy: [{ family: "asc" }, { name: "asc" }],
  });

  const totalUnits = items.reduce((s, i) => s + i.stockOnHand, 0);
  const totalValue = items.reduce((s, i) => s + i.stockOnHand * Number(i.unitCost ?? 0), 0);
  const lowStock = items.filter((i) => i.reorderPoint !== null && i.stockOnHand <= i.reorderPoint);
  const outOfStock = items.filter((i) => i.stockOnHand <= 0);
  const currency = store.currency;

  // Group by family
  const families = Array.from(new Set(items.map((i) => i.family)));
  const byFamily = families.map((fam) => ({
    family: fam,
    items: items.filter((i) => i.family === fam),
  }));

  const recentMovements = await prisma.stockMovement.findMany({
    where: { storeId: store.id, inventoryItemId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { inventoryItem: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventário físico</h1>
          <p className="text-sm text-muted-foreground">
            Stock real no armazém. Cada item mostra as variantes/packs que o consomem.
          </p>
        </div>
        <StockAdjustDialog items={items.map((i) => ({ id: i.id, name: i.name, family: i.family, stockOnHand: i.stockOnHand }))} />
      </div>

      {items.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Sem itens físicos. Corre o seed de inventário para criar os itens.
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total unidades", value: totalUnits.toLocaleString("pt-PT") },
              { label: "Valor em stock", value: formatMoney(totalValue, currency) },
              { label: "Low stock", value: lowStock.length.toString(), warn: lowStock.length > 0 },
              { label: "Sem stock", value: outOfStock.length.toString(), warn: outOfStock.length > 0 },
            ].map((k) => (
              <Card key={k.label}>
                <CardHeader className="pb-2"><CardTitle>{k.label}</CardTitle></CardHeader>
                <CardContent>
                  <div className={`text-2xl font-semibold ${k.warn ? "text-amber-500" : ""}`}>{k.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {byFamily.map(({ family, items: famItems }) => {
            const totalFam = famItems.reduce((s, i) => s + i.stockOnHand, 0);
            const valFam = famItems.reduce((s, i) => s + i.stockOnHand * Number(i.unitCost ?? 0), 0);
            return (
              <Card key={family}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-baseline">
                    <CardTitle>{family}</CardTitle>
                    <div className="text-sm text-muted-foreground tabular-nums">
                      {totalFam} un · {formatMoney(valFam, currency)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground border-b">
                      <tr>
                        <th className="text-left font-medium py-1.5">Item</th>
                        <th className="text-right font-medium py-1.5">Em stock</th>
                        <th className="text-right font-medium py-1.5">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {famItems.map((i) => {
                        const low = i.reorderPoint !== null && i.stockOnHand <= i.reorderPoint;
                        return (
                          <tr key={i.id} className={`border-b last:border-0 ${low ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}>
                            <td className="py-1.5">{i.name}</td>
                            <td className={`py-1.5 text-right tabular-nums font-medium ${
                              i.stockOnHand <= 0 ? "text-destructive" : low ? "text-amber-600" : ""
                            }`}>
                              {i.stockOnHand}
                            </td>
                            <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                              {i.unitCost ? formatMoney(i.stockOnHand * Number(i.unitCost), currency) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}

      <Card>
        <CardHeader><CardTitle>Movimentos recentes</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {recentMovements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem movimentos registados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left font-medium py-2">Data</th>
                  <th className="text-left font-medium py-2">Item</th>
                  <th className="text-left font-medium py-2">Tipo</th>
                  <th className="text-right font-medium py-2">Qtd</th>
                  <th className="text-left font-medium py-2">Nota</th>
                </tr>
              </thead>
              <tbody>
                {recentMovements.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="py-2 tabular-nums text-muted-foreground text-xs">
                      {m.createdAt.toLocaleDateString("pt-PT")}
                    </td>
                    <td className="py-2 text-xs">{m.inventoryItem?.name ?? "—"}</td>
                    <td className="py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        m.quantity > 0
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                      }`}>
                        {m.type}
                      </span>
                    </td>
                    <td className={`py-2 text-right tabular-nums font-semibold ${
                      m.quantity > 0 ? "text-emerald-600" : "text-destructive"
                    }`}>
                      {m.quantity > 0 ? "+" : ""}{m.quantity}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {m.note ?? m.reference ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

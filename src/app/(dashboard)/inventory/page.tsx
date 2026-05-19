import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StockAdjustDialog } from "./stock-adjust-dialog";

export default async function InventoryPage() {
  const user = await getSessionUser();
  const store = user ? await prisma.store.findFirst({ where: { ownerId: user.id } }) : null;
  if (!store) return null;

  const products = await prisma.product.findMany({
    where: { storeId: store.id, status: "ACTIVE" },
    include: {
      variants: {
        orderBy: { title: "asc" },
        select: {
          id: true, title: true, sku: true,
          stockOnHand: true, stockReserved: true, reorderPoint: true,
          unitCost: true,
        },
      },
    },
    orderBy: { title: "asc" },
  });

  const allVariants = products.flatMap((p) => p.variants);
  const totalUnits = allVariants.reduce((s, v) => s + v.stockOnHand, 0);
  const totalValue = allVariants.reduce(
    (s, v) => s + v.stockOnHand * Number(v.unitCost ?? 0),
    0,
  );
  const lowStock = allVariants.filter(
    (v) => v.reorderPoint !== null && v.stockOnHand <= v.reorderPoint,
  );
  const outOfStock = allVariants.filter((v) => v.stockOnHand <= 0);
  const currency = store.currency;

  const recentMovements = await prisma.stockMovement.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      variant: { select: { title: true, product: { select: { title: true } } } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">Stock actual + histórico de movimentos</p>
        </div>
        <StockAdjustDialog products={products} storeId={store.id} />
      </div>

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

      {lowStock.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
          <p className="text-sm font-medium">⚠️ Atenção — stock baixo</p>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            {lowStock.map((v) => (
              <div key={v.id}>{v.title} — {v.stockOnHand} un (reorder point: {v.reorderPoint})</div>
            ))}
          </div>
        </div>
      )}

      {products.map((product) => {
        const totalProd = product.variants.reduce((s, v) => s + v.stockOnHand, 0);
        const totalVal = product.variants.reduce(
          (s, v) => s + v.stockOnHand * Number(v.unitCost ?? 0), 0,
        );
        return (
          <Card key={product.id}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-baseline">
                <CardTitle>{product.title}</CardTitle>
                <div className="text-sm text-muted-foreground tabular-nums">
                  {totalProd} un · {formatMoney(totalVal, currency)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left font-medium py-1.5">Variante</th>
                    <th className="text-left font-medium py-1.5">SKU</th>
                    <th className="text-right font-medium py-1.5">Em stock</th>
                    <th className="text-right font-medium py-1.5">Reservado</th>
                    <th className="text-right font-medium py-1.5">Disponível</th>
                    <th className="text-right font-medium py-1.5">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((v) => {
                    const available = v.stockOnHand - v.stockReserved;
                    const low = v.reorderPoint !== null && v.stockOnHand <= v.reorderPoint;
                    return (
                      <tr key={v.id} className={`border-b last:border-0 ${low ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}>
                        <td className="py-1.5 text-muted-foreground">{v.title}</td>
                        <td className="py-1.5 text-xs text-muted-foreground tabular-nums">{v.sku ?? "—"}</td>
                        <td className={`py-1.5 text-right tabular-nums font-medium ${
                          v.stockOnHand <= 0 ? "text-destructive" : low ? "text-amber-600" : ""
                        }`}>
                          {v.stockOnHand}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-muted-foreground">{v.stockReserved}</td>
                        <td className="py-1.5 text-right tabular-nums">{available}</td>
                        <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                          {v.unitCost ? formatMoney(v.stockOnHand * Number(v.unitCost), currency) : "—"}
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
                  <th className="text-left font-medium py-2">Produto / variante</th>
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
                    <td className="py-2 text-xs">
                      {m.variant.product.title}{" "}
                      <span className="text-muted-foreground">{m.variant.title}</span>
                    </td>
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

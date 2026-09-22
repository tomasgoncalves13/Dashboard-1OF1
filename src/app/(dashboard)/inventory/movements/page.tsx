import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { resolveRange } from "@/lib/dashboard/range";
import { InventoryTabs } from "../inventory-tabs";

type VariantAgg = {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  site: number;
  physical: number;
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

  const [orderItems, manualSaleItems] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        variantId: { not: null },
        order: { storeId: store.id, processedAt: { gte: range.from, lte: range.to } },
      },
      select: {
        quantity: true,
        variantId: true,
        variant: { select: { title: true, product: { select: { title: true } } } },
      },
    }),
    prisma.manualSaleItem.findMany({
      where: { sale: { storeId: store.id, soldAt: { gte: range.from, lte: range.to } } },
      select: {
        quantity: true,
        variantId: true,
        variant: { select: { title: true, product: { select: { title: true } } } },
        sale: { select: { channel: true, club: { select: { name: true } } } },
      },
    }),
  ]);

  const byVariant = new Map<string, VariantAgg>();
  const getEntry = (variantId: string, variantTitle: string, productTitle: string) => {
    let entry = byVariant.get(variantId);
    if (!entry) {
      entry = { variantId, productTitle, variantTitle, site: 0, physical: 0, bySource: new Map() };
      byVariant.set(variantId, entry);
    }
    return entry;
  };

  for (const oi of orderItems) {
    if (!oi.variantId || !oi.variant) continue;
    const entry = getEntry(oi.variantId, oi.variant.title, oi.variant.product.title);
    entry.site += oi.quantity;
  }

  for (const msi of manualSaleItems) {
    if (!msi.variant) continue;
    const entry = getEntry(msi.variantId, msi.variant.title, msi.variant.product.title);
    entry.physical += msi.quantity;
    const source = msi.sale.channel === "CLUB" ? (msi.sale.club?.name ?? "Clube") : "Venda normal";
    entry.bySource.set(source, (entry.bySource.get(source) ?? 0) + msi.quantity);
  }

  const byProduct = new Map<string, VariantAgg[]>();
  for (const entry of byVariant.values()) {
    const total = entry.site + entry.physical;
    if (total <= 0) continue;
    const list = byProduct.get(entry.productTitle) ?? [];
    list.push(entry);
    byProduct.set(entry.productTitle, list);
  }

  const products = [...byProduct.entries()]
    .map(([productTitle, variants]) => ({
      productTitle,
      variants: variants.sort((a, b) => (b.site + b.physical) - (a.site + a.physical)),
      total: variants.reduce((s, v) => s + v.site + v.physical, 0),
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <InventoryTabs />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Movimentos de Inventário</h1>
          <p className="text-sm text-muted-foreground">
            Unidades que saíram por produto/variante · {range.label}
          </p>
        </div>
        <DateRangePicker active={range.preset} />
      </div>

      {products.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Sem movimentos de saída no período selecionado.
        </Card>
      ) : (
        products.map(({ productTitle, variants, total }) => (
          <Card key={productTitle}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-baseline">
                <CardTitle className="text-foreground">{productTitle}</CardTitle>
                <div className="text-sm font-medium text-destructive tabular-nums">-{total}</div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {variants.map((v) => {
                const vTotal = v.site + v.physical;
                const sources = [...v.bySource.entries()].sort((a, b) => b[1] - a[1]);
                return (
                  <div key={v.variantId} className="flex flex-col gap-0.5 border-b last:border-0 pb-3 last:pb-0">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm">{v.variantTitle}</span>
                      <span className="text-sm font-semibold text-destructive tabular-nums">-{vTotal}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Site: {v.site}
                      {v.physical > 0 && (
                        <>
                          {" "}· Físico: {v.physical}
                          {sources.length > 0 && (
                            <> ({sources.map(([name, qty]) => `${name} ${qty}`).join(" · ")})</>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

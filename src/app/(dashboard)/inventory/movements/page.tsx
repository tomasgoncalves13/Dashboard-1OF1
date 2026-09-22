import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { resolveRange } from "@/lib/dashboard/range";
import { InventoryTabs } from "../inventory-tabs";
import { canonicalizeVariant } from "@/lib/catalog/canonical-sizes";

type VariantAgg = {
  variantKey: string;
  productKey: string;
  productLabel: string;
  variantLabel: string;
  site: number;
  physical: number;
  bySource: Map<string, number>;
};

function resolveKeys(productHandle: string | null, productTitle: string, variantTitle: string, variantId: string) {
  const canon = canonicalizeVariant(productHandle, variantTitle);
  if (canon) {
    return {
      productKey: canon.productKey,
      productLabel: canon.productLabel,
      variantKey: canon.variantKey,
      variantLabel: canon.variantLabel,
    };
  }
  return { productKey: productTitle, productLabel: productTitle, variantKey: variantId, variantLabel: variantTitle };
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

  const [orderItems, manualSaleItems] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        variantId: { not: null },
        order: { storeId: store.id, processedAt: { gte: range.from, lte: range.to } },
      },
      select: {
        quantity: true,
        variantId: true,
        variant: { select: { title: true, product: { select: { title: true, handle: true } } } },
      },
    }),
    prisma.manualSaleItem.findMany({
      where: { sale: { storeId: store.id, soldAt: { gte: range.from, lte: range.to } } },
      select: {
        quantity: true,
        variantId: true,
        variant: { select: { title: true, product: { select: { title: true, handle: true } } } },
        sale: { select: { channel: true, club: { select: { name: true } } } },
      },
    }),
  ]);

  const byVariant = new Map<string, VariantAgg>();
  const getEntry = (productHandle: string | null, productTitle: string, variantTitle: string, variantId: string) => {
    const keys = resolveKeys(productHandle, productTitle, variantTitle, variantId);
    let entry = byVariant.get(keys.variantKey);
    if (!entry) {
      entry = { ...keys, site: 0, physical: 0, bySource: new Map() };
      byVariant.set(keys.variantKey, entry);
    }
    return entry;
  };

  for (const oi of orderItems) {
    if (!oi.variantId || !oi.variant) continue;
    const entry = getEntry(oi.variant.product.handle, oi.variant.product.title, oi.variant.title, oi.variantId);
    entry.site += oi.quantity;
  }

  for (const msi of manualSaleItems) {
    if (!msi.variant) continue;
    const entry = getEntry(msi.variant.product.handle, msi.variant.product.title, msi.variant.title, msi.variantId);
    entry.physical += msi.quantity;
    const source = msi.sale.channel === "CLUB" ? (msi.sale.club?.name ?? "Clube") : "Venda normal";
    entry.bySource.set(source, (entry.bySource.get(source) ?? 0) + msi.quantity);
  }

  const byProduct = new Map<string, { productLabel: string; variants: VariantAgg[] }>();
  for (const entry of byVariant.values()) {
    const total = entry.site + entry.physical;
    if (total <= 0) continue;
    const group = byProduct.get(entry.productKey) ?? { productLabel: entry.productLabel, variants: [] };
    group.variants.push(entry);
    byProduct.set(entry.productKey, group);
  }

  const products = [...byProduct.entries()]
    .map(([productKey, { productLabel, variants }]) => ({
      productKey,
      productLabel,
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
        products.map(({ productKey, productLabel, variants, total }) => (
          <Card key={productKey}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-baseline">
                <CardTitle className="text-foreground">{productLabel}</CardTitle>
                <div className="text-sm font-medium text-destructive tabular-nums">-{total}</div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {variants.map((v) => {
                const vTotal = v.site + v.physical;
                const sources = [...v.bySource.entries()].sort((a, b) => b[1] - a[1]);
                return (
                  <div key={v.variantKey} className="flex flex-col gap-0.5 border-b last:border-0 pb-3 last:pb-0">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm">{v.variantLabel}</span>
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

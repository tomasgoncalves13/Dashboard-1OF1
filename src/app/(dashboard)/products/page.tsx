import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export default async function ProductsPage() {
  const user = await getSessionUser();
  const store = user ? await prisma.store.findFirst({ where: { ownerId: user.id } }) : null;

  const variants = store
    ? await prisma.productVariant.findMany({
        where: { storeId: store.id },
        orderBy: [{ stockOnHand: "asc" }, { title: "asc" }],
        take: 100,
        include: { product: { select: { title: true, imageUrl: true, status: true } } },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <p className="text-sm text-muted-foreground">{variants.length} SKUs · cost & margin per variant</p>
      </div>

      {variants.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          No products yet. Go to <Link href="/settings" className="underline">Settings</Link> and run a full sync.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <Th>Product</Th>
                  <Th>SKU</Th>
                  <Th className="text-right">Price</Th>
                  <Th className="text-right">Cost</Th>
                  <Th className="text-right">Margin</Th>
                  <Th className="text-right">Stock</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {variants.map((v) => {
                  const price = Number(v.price);
                  const cost = Number(v.unitCost ?? 0);
                  const margin = price > 0 ? ((price - cost) / price) * 100 : null;
                  return (
                    <tr key={v.id} className="hover:bg-accent/40">
                      <Td>
                        <div className="flex items-center gap-3">
                          {v.product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={v.product.imageUrl} alt="" className="size-9 rounded object-cover" />
                          ) : (
                            <div className="size-9 rounded bg-muted" />
                          )}
                          <div>
                            <div className="font-medium">{v.product.title}</div>
                            <div className="text-xs text-muted-foreground">{v.title}</div>
                          </div>
                        </div>
                      </Td>
                      <Td className="font-mono text-xs">{v.sku ?? "—"}</Td>
                      <Td className="text-right tabular-nums">{formatMoney(price)}</Td>
                      <Td className="text-right tabular-nums text-muted-foreground">
                        {v.unitCost ? formatMoney(cost) : "—"}
                      </Td>
                      <Td className="text-right tabular-nums">{margin === null ? "—" : `${margin.toFixed(1)}%`}</Td>
                      <Td className={`text-right tabular-nums ${v.stockOnHand <= 5 ? "text-warning font-medium" : ""}`}>
                        {v.stockOnHand}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-2.5 text-left font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { getOrderOverheads } from "@/lib/profit/order-costs";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export default async function ProductsPage() {
  const user = await getSessionUser();
  const store = user ? await prisma.store.findFirst({ where: { ownerId: user.id } }) : null;

  const [variants, overheads] = store
    ? await Promise.all([
        prisma.productVariant.findMany({
          where: { storeId: store.id },
          orderBy: [{ product: { title: "asc" } }, { title: "asc" }],
          take: 200,
          include: { product: { select: { title: true, imageUrl: true, status: true } } },
        }),
        getOrderOverheads(store.id),
      ])
    : [[], null];

  const packagingOverhead = overheads
    ? overheads.freeGiftCost + overheads.bubbleMailerCost + overheads.cardCost + overheads.stickerCost
    : 1.64;
  const shippingPT = overheads?.shippingDomestic ?? 2.34;
  const shippingEU = overheads?.shippingEU ?? 4.25;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catálogo</h1>
        <p className="text-sm text-muted-foreground">
          {variants.length} SKUs · overhead embalagem {formatMoney(packagingOverhead)} · envio PT {formatMoney(shippingPT)} / EU {formatMoney(shippingEU)}
        </p>
      </div>

      {variants.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Sem produtos. Vai a <Link href="/settings" className="underline">Settings</Link> e faz sync.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <Th>Produto</Th>
                  <Th>SKU</Th>
                  <Th className="text-right">PVP</Th>
                  <Th className="text-right">Custo Prod.</Th>
                  <Th className="text-right">Total PT</Th>
                  <Th className="text-right">Lucro PT</Th>
                  <Th className="text-right">Total EU</Th>
                  <Th className="text-right">Lucro EU</Th>
                  <Th className="text-right">Stock</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {variants.map((v) => {
                  const price = Number(v.price);
                  const unitCost = v.unitCost ? Number(v.unitCost) : null;
                  const totalPT = unitCost !== null ? unitCost + packagingOverhead + shippingPT : null;
                  const totalEU = unitCost !== null ? unitCost + packagingOverhead + shippingEU : null;
                  const lucroPT = totalPT !== null ? price - totalPT : null;
                  const lucroEU = totalEU !== null ? price - totalEU : null;

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
                        {unitCost !== null ? formatMoney(unitCost) : "—"}
                      </Td>
                      <Td className="text-right tabular-nums text-muted-foreground">
                        {totalPT !== null ? formatMoney(totalPT) : "—"}
                      </Td>
                      <Td className={`text-right tabular-nums font-medium ${lucroPT !== null && lucroPT > 0 ? "text-green-500" : "text-red-500"}`}>
                        {lucroPT !== null ? formatMoney(lucroPT) : "—"}
                      </Td>
                      <Td className="text-right tabular-nums text-muted-foreground">
                        {totalEU !== null ? formatMoney(totalEU) : "—"}
                      </Td>
                      <Td className={`text-right tabular-nums font-medium ${lucroEU !== null && lucroEU > 0 ? "text-green-500" : "text-red-500"}`}>
                        {lucroEU !== null ? formatMoney(lucroEU) : "—"}
                      </Td>
                      <Td className={`text-right tabular-nums ${v.stockOnHand <= 5 ? "text-yellow-500 font-medium" : ""}`}>
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

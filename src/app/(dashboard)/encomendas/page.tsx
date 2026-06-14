import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EncomendasPage() {
  const user = await getSessionUser();
  const store = user ? await prisma.store.findFirst({ where: { ownerId: user.id } }) : null;
  if (!store) return null;

  const orders = await prisma.purchaseOrder.findMany({
    where: { storeId: store.id },
    include: { items: true },
    orderBy: { orderNumber: "asc" },
  });

  const totalInvested = orders.reduce((s, o) => s + Number(o.totalCost), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Importações</h1>
          <p className="text-sm text-muted-foreground">
            {orders.length} encomendas · {formatMoney(totalInvested, store.currency)} investido no total
          </p>
        </div>
      </div>

      {orders.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Sem encomendas registadas. Clica em "Nova Encomenda" para começar.
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs rounded border px-2 py-0.5">#{order.orderNumber}</span>
                    <CardTitle className="text-base">{order.supplier}</CardTitle>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{formatMoney(Number(order.totalCost), store.currency)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.date).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                {order.notes && (
                  <p className="text-sm text-muted-foreground mt-1">{order.notes}</p>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <table className="w-full text-sm">
                  <thead className="border-b text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="pb-2 text-left font-medium">Produto</th>
                      <th className="pb-2 text-right font-medium">Qtd</th>
                      <th className="pb-2 text-right font-medium">Produção</th>
                      <th className="pb-2 text-right font-medium">Transporte</th>
                      <th className="pb-2 text-right font-medium">Total</th>
                      <th className="pb-2 text-right font-medium">€/un</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {order.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2">
                          <div>{item.productName}</div>
                          {item.note && <div className="text-xs text-muted-foreground">{item.note}</div>}
                        </td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          {item.quantity ?? "—"}
                        </td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          {item.productionCost ? formatMoney(Number(item.productionCost), store.currency) : "—"}
                        </td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          {item.transportCost ? formatMoney(Number(item.transportCost), store.currency) : "—"}
                        </td>
                        <td className="py-2 text-right tabular-nums font-medium">
                          {formatMoney(Number(item.totalCost), store.currency)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          {item.unitCost ? formatMoney(Number(item.unitCost), store.currency) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

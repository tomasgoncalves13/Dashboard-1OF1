import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export default async function OrdersPage() {
  const user = await getSessionUser();
  const store = user ? await prisma.store.findFirst({ where: { ownerId: user.id } }) : null;
  const orders = store
    ? await prisma.order.findMany({
        where: { storeId: store.id },
        orderBy: { processedAt: "desc" },
        take: 50,
        include: { customer: true, _count: { select: { items: true } } },
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">{orders.length} most recent · per-order profit</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          No orders yet. Go to <Link href="/settings" className="underline">Settings</Link> and run a full sync.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <Th>Order</Th>
                  <Th>Date</Th>
                  <Th>Customer</Th>
                  <Th>Country</Th>
                  <Th className="text-right">Items</Th>
                  <Th className="text-right">Revenue</Th>
                  <Th className="text-right">COGS</Th>
                  <Th className="text-right">Fees</Th>
                  <Th className="text-right">Net profit</Th>
                  <Th className="text-right">Margin</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-accent/40">
                    <Td className="font-medium">{o.orderNumber ?? o.id.slice(0, 8)}</Td>
                    <Td className="text-muted-foreground">{o.processedAt.toLocaleDateString()}</Td>
                    <Td>
                      {o.customer ? `${o.customer.firstName ?? ""} ${o.customer.lastName ?? ""}`.trim() || o.customer.email : "—"}
                    </Td>
                    <Td className="text-muted-foreground">{o.shippingCountry ?? "—"}</Td>
                    <Td className="text-right tabular-nums">{o._count.items}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(o.total.toString(), o.currency)}</Td>
                    <Td className="text-right tabular-nums text-muted-foreground">{formatMoney(o.cogsTotal.toString(), o.currency)}</Td>
                    <Td className="text-right tabular-nums text-muted-foreground">{formatMoney(o.paymentFees.toString(), o.currency)}</Td>
                    <Td className={`text-right tabular-nums font-medium ${Number(o.netProfit) >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatMoney(o.netProfit.toString(), o.currency)}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {o.marginPct ? `${(Number(o.marginPct) * 100).toFixed(1)}%` : "—"}
                    </Td>
                  </tr>
                ))}
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

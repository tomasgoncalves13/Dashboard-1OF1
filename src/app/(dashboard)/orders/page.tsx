import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import { resolveRange } from "@/lib/dashboard/range";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  const store = user ? await prisma.store.findFirst({ where: { ownerId: user.id } }) : null;
  if (!store) return null;

  const sp = await searchParams;
  const range = resolveRange(sp);

  const orders = await prisma.order.findMany({
    where: {
      storeId: store.id,
      processedAt: { gte: range.from, lte: range.to },
    },
    orderBy: { processedAt: "desc" },
    include: { customer: true, _count: { select: { items: true } } },
  });

  // Summary for the period
  const paid = orders.filter((o) => o.financialStatus === "PAID");
  const totalRevenue = paid.reduce((s, o) => s + Number(o.total), 0);
  const totalNetProfit = paid.reduce((s, o) => s + Number(o.netProfit), 0);
  const totalCogs = paid.reduce((s, o) => s + Number(o.cogsTotal), 0);
  const avgMargin = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;
  const currency = store.currency;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">{range.label} · {orders.length} encomendas</p>
        </div>
        <DateRangePicker active={range.preset} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Revenue (pagas)", value: formatMoney(totalRevenue, currency) },
          { label: "Net profit", value: formatMoney(totalNetProfit, currency) },
          { label: "COGS", value: formatMoney(totalCogs, currency) },
          { label: "Margem média", value: `${avgMargin.toFixed(1)}%` },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2"><CardTitle>{k.label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-semibold">{k.value}</div></CardContent>
          </Card>
        ))}
      </div>

      {orders.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Sem encomendas no período. <Link href="/settings" className="underline">Sincronizar Shopify</Link>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <Th>Order</Th>
                  <Th>Data</Th>
                  <Th>Cliente</Th>
                  <Th>País</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Itens</Th>
                  <Th className="text-right">Revenue</Th>
                  <Th className="text-right">COGS</Th>
                  <Th className="text-right">Embal.</Th>
                  <Th className="text-right">Fees</Th>
                  <Th className="text-right">Net profit</Th>
                  <Th className="text-right">Margem</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => {
                  const isPaid = o.financialStatus === "PAID";
                  return (
                    <tr key={o.id} className={`hover:bg-accent/40 ${!isPaid ? "opacity-50" : ""}`}>
                      <Td className="font-medium text-xs">{o.orderNumber ?? o.id.slice(0, 8)}</Td>
                      <Td className="text-muted-foreground text-xs">{o.processedAt.toLocaleDateString("pt-PT")}</Td>
                      <Td className="text-xs">
                        {o.customer
                          ? `${o.customer.firstName ?? ""} ${o.customer.lastName ?? ""}`.trim() || o.customer.email
                          : "—"}
                      </Td>
                      <Td className="text-muted-foreground text-xs">{o.shippingCountry ?? "—"}</Td>
                      <Td>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          isPaid
                            ? "bg-emerald-100 text-emerald-700"
                            : o.financialStatus === "REFUNDED"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-600"
                        }`}>
                          {o.financialStatus ?? "—"}
                        </span>
                      </Td>
                      <Td className="text-right tabular-nums">{o._count.items}</Td>
                      <Td className="text-right tabular-nums">{formatMoney(o.total.toString(), o.currency)}</Td>
                      <Td className="text-right tabular-nums text-muted-foreground">{formatMoney(o.cogsTotal.toString(), o.currency)}</Td>
                      <Td className="text-right tabular-nums text-muted-foreground">{formatMoney(o.packagingCost.toString(), o.currency)}</Td>
                      <Td className="text-right tabular-nums text-muted-foreground">{formatMoney(o.paymentFees.toString(), o.currency)}</Td>
                      <Td className={`text-right tabular-nums font-medium ${Number(o.netProfit) >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {formatMoney(o.netProfit.toString(), o.currency)}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {o.marginPct ? `${(Number(o.marginPct) * 100).toFixed(1)}%` : "—"}
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
  return <th className={`px-3 py-2.5 text-left font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>;
}

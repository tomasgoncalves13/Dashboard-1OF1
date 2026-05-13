import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, formatNumber } from "@/lib/utils";
import { RevenueChart } from "./revenue-chart";
import { resolveRange } from "@/lib/dashboard/range";
import { getKpis, getDailyRevenue, type KpiSet } from "@/lib/dashboard/kpis";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  const store = user ? await prisma.store.findFirst({ where: { ownerId: user.id } }) : null;
  if (!store) return null;

  const sp = await searchParams;
  const range = resolveRange(sp);

  const [paid, all, daily] = await Promise.all([
    getKpis(store.id, range.from, range.to, { paidOnly: true }),
    getKpis(store.id, range.from, range.to, { paidOnly: false }),
    getDailyRevenue(store.id, range.from, range.to, { paidOnly: true }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">{range.label} · {store.name}</p>
        </div>
        <DateRangePicker active={range.preset} />
      </div>

      <KpiGrid kpis={paid} currency={store.currency} />

      <Card>
        <CardHeader>
          <CardTitle>Revenue & net profit · encomendas pagas</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <RevenueChart data={daily.map((r) => ({
            day: r.day instanceof Date ? r.day.toISOString().slice(5, 10) : String(r.day).slice(5, 10),
            revenue: r.revenue,
            netProfit: r.net_profit,
          }))} />
        </CardContent>
      </Card>

      <div className="space-y-3 pt-4 border-t">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Auditoria · todas as encomendas</h2>
          <p className="text-xs text-muted-foreground">
            Inclui pendentes, expiradas e reembolsadas. Para confirmares que os valores do Shopify batem certo.
          </p>
        </div>
        <KpiGrid kpis={all} currency={store.currency} muted />
      </div>
    </div>
  );
}

function KpiGrid({ kpis, currency, muted }: { kpis: KpiSet; currency: string; muted?: boolean }) {
  const cards = [
    { label: "Revenue", value: formatMoney(kpis.revenue, currency) },
    { label: "Net profit", value: formatMoney(kpis.netProfit, currency) },
    { label: "Margem", value: kpis.margin === null ? "—" : `${kpis.margin.toFixed(1)}%` },
    { label: "Encomendas", value: formatNumber(kpis.ordersCount) },
    { label: "AOV", value: formatMoney(kpis.aov, currency) },
    { label: "COGS", value: formatMoney(kpis.cogs, currency) },
    { label: "Taxas pagamento", value: formatMoney(kpis.fees, currency) },
    { label: "Pagamento p/ conta bancária", value: "—" },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((k) => (
        <Card key={k.label} className={muted ? "bg-muted/30" : undefined}>
          <CardHeader className="pb-2"><CardTitle>{k.label}</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-semibold tracking-tight ${muted ? "text-muted-foreground" : ""}`}>
              {k.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

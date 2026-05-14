import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, formatNumber } from "@/lib/utils";
import { RevenueChart } from "./revenue-chart";
import { resolveRange } from "@/lib/dashboard/range";
import {
  getKpis,
  getDailyRevenue,
  getMoneyToBank,
  getGatewayBreakdown,
  type KpiSet,
  type GatewayRow,
} from "@/lib/dashboard/kpis";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";

type Money = {
  payoutsNet: number;
  payoutsCount: number;
  eupagoNet: number;
  eupagoFees: number;
  eupagoCount: number;
  othersGross: number;
  total: number;
};

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

  const [paid, all, daily, money, gateways] = await Promise.all([
    getKpis(store.id, range.from, range.to, { paidOnly: true }),
    getKpis(store.id, range.from, range.to, { paidOnly: false }),
    getDailyRevenue(store.id, range.from, range.to, { paidOnly: true }),
    getMoneyToBank(store.id, range.from, range.to),
    getGatewayBreakdown(store.id, range.from, range.to),
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

      <KpiGrid kpis={paid} currency={store.currency} money={money} />

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

      <GatewayBreakdown rows={gateways} currency={store.currency} money={money} />

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

function KpiGrid({
  kpis,
  currency,
  muted,
  money,
}: {
  kpis: KpiSet;
  currency: string;
  muted?: boolean;
  money?: Money;
}) {
  const cards = [
    { label: "Revenue", value: formatMoney(kpis.revenue, currency) },
    { label: "Net profit", value: formatMoney(kpis.netProfit, currency) },
    { label: "Margem", value: kpis.margin === null ? "—" : `${kpis.margin.toFixed(1)}%` },
    { label: "Encomendas", value: formatNumber(kpis.ordersCount) },
    { label: "AOV", value: formatMoney(kpis.aov, currency) },
    { label: "COGS", value: formatMoney(kpis.cogs, currency) },
    { label: "Taxas pagamento", value: formatMoney(kpis.fees, currency) },
    {
      label: "Pagamento p/ conta bancária",
      value: money ? formatMoney(money.total, currency) : "—",
      hint: money
        ? `SP net: ${formatMoney(money.payoutsNet, currency)} · Eupago net: ${formatMoney(money.eupagoNet, currency)} · Outros (bruto): ${formatMoney(money.othersGross, currency)}`
        : undefined,
    },
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
            {"hint" in k && k.hint && (
              <div className="text-[11px] text-muted-foreground mt-1 leading-tight">{k.hint}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function GatewayBreakdown({
  rows,
  currency,
  money,
}: {
  rows: GatewayRow[];
  currency: string;
  money: Money;
}) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendas por método de pagamento · encomendas pagas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="text-left font-medium py-2">Gateway</th>
                <th className="text-right font-medium py-2">Encomendas</th>
                <th className="text-right font-medium py-2">Revenue bruta</th>
                <th className="text-right font-medium py-2">→ Conta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isShopify = r.gateway === "shopify_payments";
                const isEupago = r.gateway === "Eupago Payments Gateway";
                let toBank = r.revenue;
                let badge: string | null = null;
                if (isShopify) {
                  toBank = money.payoutsNet;
                  badge = `net, ${money.payoutsCount}×`;
                } else if (isEupago) {
                  toBank = money.eupagoNet;
                  badge = `net, fees ${formatMoney(money.eupagoFees, currency)}`;
                }
                return (
                  <tr key={r.gateway} className="border-b last:border-0">
                    <td className="py-2 font-medium">{r.gateway}</td>
                    <td className="py-2 text-right tabular-nums">{r.orders}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(r.revenue, currency)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatMoney(toBank, currency)}
                      {badge && <span className="text-[10px] text-muted-foreground ml-1">({badge})</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="pt-3">Total → conta</td>
                <td></td>
                <td></td>
                <td className="pt-3 text-right tabular-nums">{formatMoney(money.total, currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Shopify Payments e Eupago mostram o net real (depois das fees) — dados das APIs respetivas.
          PayPal, Stripe e outros usam a revenue bruta da encomenda (não temos acesso às fees via API).
          Eupago só guarda dados dos últimos 3 meses na API — para histórico antigo, importa CSV do backoffice.
        </p>
      </CardContent>
    </Card>
  );
}

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
  getPhysicalKpis,
  getMonthlyPnL,
  type KpiSet,
  type GatewayRow,
  type PhysicalKpiSet,
  type MonthlyPnLRow,
} from "@/lib/dashboard/kpis";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { getMonthlyCashflow, getFinanceBreakdown } from "@/lib/finance/cashflow";
import { CashflowChart } from "../finance/cashflow-chart";

const CHANNEL_LABELS: Record<string, string> = {
  CLUB: "Clubes",
  MANUAL: "Venda própria",
  EVENT: "Evento",
  POPUP: "Pop-up",
  WHOLESALE: "Wholesale",
};

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

  const [paid, all, daily, money, gateways, physical, monthlyPnL, monthlyCashflow, financeBreakdown] = await Promise.all([
    getKpis(store.id, range.from, range.to, { paidOnly: true }),
    getKpis(store.id, range.from, range.to, { paidOnly: false }),
    getDailyRevenue(store.id, range.from, range.to, { paidOnly: true }),
    getMoneyToBank(store.id, range.from, range.to),
    getGatewayBreakdown(store.id, range.from, range.to),
    getPhysicalKpis(store.id, range.from, range.to),
    getMonthlyPnL(store.id, 6),
    getMonthlyCashflow(store.id, 6),
    getFinanceBreakdown(store.id, range.from, range.to),
  ]);

  const currency = store.currency;
  const totalRevenue = paid.revenue + physical.revenue;
  const totalNetProfit = paid.netProfit + physical.netProfit;

  const totalIn = financeBreakdown.cashIn;
  const totalOut = financeBreakdown.cashOut;
  const netCashflow = financeBreakdown.netCashflow;

  const orderAgg = await prisma.order.aggregate({
    where: {
      storeId: store.id,
      processedAt: { gte: range.from, lte: range.to },
      financialStatus: "PAID",
    },
    _sum: { netProfit: true, total: true },
  });
  const accountingProfit = Number(orderAgg._sum.netProfit ?? 0);
  const accountingRevenue = Number(orderAgg._sum.total ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finance · Cashflow</h1>
          <p className="text-sm text-muted-foreground">{range.label} · dinheiro real que entrou e saiu</p>
        </div>
        <DateRangePicker active={range.preset} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle>Cash in</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-600">{formatMoney(totalIn, currency)}</div>
            <p className="text-xs text-muted-foreground mt-1">Vendas físicas + Vendas site</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle>Cash out</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-destructive">{formatMoney(totalOut, currency)}</div>
            <p className="text-xs text-muted-foreground mt-1">Todos os custos do período</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle>Net cashflow</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-semibold ${netCashflow >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {formatMoney(netCashflow, currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle>Lucro contabilístico</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatMoney(accountingProfit, currency)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              vs revenue {formatMoney(accountingRevenue, currency)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue + cost breakdown */}
      <div>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Receitas</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Vendas físicas</CardTitle></CardHeader>
            <CardContent>
              <div className="text-xl font-semibold text-emerald-600">{formatMoney(financeBreakdown.physicalRevenue, currency)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Vendas site</CardTitle></CardHeader>
            <CardContent>
              <div className="text-xl font-semibold text-emerald-600">{formatMoney(financeBreakdown.onlineRevenue, currency)}</div>
              <p className="text-xs text-muted-foreground mt-1">Shopify + Eupago</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Custos</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Custo vendas físicas", value: financeBreakdown.physicalCost, sub: "COGS + comissão clubes" },
            { label: "Custo encomendas site", value: financeBreakdown.onlineOrderCost, sub: "COGS + embalagem + taxas + envio" },
            { label: "Custo Facebook Ads", value: financeBreakdown.facebookAdsCost },
            { label: "Custo Google Ads", value: financeBreakdown.googleAdsCost },
            { label: "Custo influencers", value: financeBreakdown.influencerCost },
            { label: "Custo despesas mensais", value: financeBreakdown.monthlyExpensesCost, sub: "Shopify, software, academia, etc" },
          ].map((c) => (
            <Card key={c.label}>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle></CardHeader>
              <CardContent>
                <div className="text-xl font-semibold text-destructive">{formatMoney(c.value, currency)}</div>
                {c.sub && <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Monthly cashflow chart */}
      <Card>
        <CardHeader>
          <CardTitle>Cashflow mensal — últimos 6 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <CashflowChart data={monthlyCashflow} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pt-4 border-t">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">{range.label} · {store.name}</p>
        </div>
      </div>

      {/* Combined headline */}
      {physical.salesCount > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Revenue total", value: formatMoney(totalRevenue, currency), hint: "Online + físico" },
            { label: "Profit combinado", value: formatMoney(totalNetProfit, currency), hint: "Ecom net + físico gross" },
            {
              label: "Online revenue",
              value: formatMoney(paid.revenue, currency),
              hint: `${paid.ordersCount} encomendas`,
            },
            {
              label: "Físico revenue",
              value: formatMoney(physical.revenue, currency),
              hint: `${physical.salesCount} vendas`,
            },
          ].map((k) => (
            <Card key={k.label} className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-1"><CardTitle className="text-xs">{k.label}</CardTitle></CardHeader>
              <CardContent>
                <div className="text-xl font-semibold">{k.value}</div>
                {k.hint && <p className="text-[11px] text-muted-foreground mt-0.5">{k.hint}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Ecommerce KPIs */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Ecommerce (Shopify)</h2>
        <KpiGrid kpis={paid} currency={currency} />
      </div>

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

      <GatewayBreakdown rows={gateways} currency={currency} money={money} />

      {/* Physical Sales */}
      {physical.salesCount > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Vendas Físicas</h2>
          <PhysicalSection physical={physical} currency={currency} />
        </div>
      )}

      {/* Monthly P&L */}
      <MonthlyPnLTable rows={monthlyPnL} currency={currency} />

      {/* Audit */}
      <div className="space-y-3 pt-4 border-t">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Auditoria · todas as encomendas Site</h2>
          <p className="text-xs text-muted-foreground">
            Inclui pendentes, expiradas e reembolsadas.
          </p>
        </div>
        <KpiGrid kpis={all} currency={currency} muted />
      </div>
    </div>
  );
}

function KpiGrid({
  kpis,
  currency,
  muted,
}: {
  kpis: KpiSet;
  currency: string;
  muted?: boolean;
}) {
  const cards = [
    { label: "Revenue", value: formatMoney(kpis.revenue, currency) },
    { label: "Net profit", value: formatMoney(kpis.netProfit, currency) },
    { label: "Margem", value: kpis.margin === null ? "—" : `${kpis.margin.toFixed(1)}%` },
    { label: "Encomendas", value: formatNumber(kpis.ordersCount) },
    { label: "AOV", value: formatMoney(kpis.aov, currency) },
    { label: "Total de produtos", value: formatMoney(kpis.cogs, currency) },
    { label: "Total de envios", value: formatMoney(kpis.shippingCost, currency) },
    { label: "Taxas pagamento", value: formatMoney(kpis.fees, currency) },
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

function PhysicalSection({ physical, currency }: { physical: PhysicalKpiSet; currency: string }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Revenue", value: formatMoney(physical.revenue, currency) },
          { label: "Profit", value: formatMoney(physical.netProfit, currency) },
          { label: `Custo produtos (${physical.itemsCount} und.)`, value: formatMoney(physical.cogs, currency) },
          { label: "Comissão paga", value: formatMoney(physical.commission, currency) },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2"><CardTitle>{k.label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-semibold">{k.value}</div></CardContent>
          </Card>
        ))}
      </div>
      {physical.byChannel.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Por canal</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left font-medium py-2">Canal</th>
                  <th className="text-right font-medium py-2">Vendas</th>
                  <th className="text-right font-medium py-2">Revenue</th>
                  <th className="text-right font-medium py-2">Gross profit</th>
                  <th className="text-right font-medium py-2">Margem</th>
                </tr>
              </thead>
              <tbody>
                {physical.byChannel.map((r) => (
                  <tr key={r.channel} className="border-b last:border-0">
                    <td className="py-2 font-medium">{CHANNEL_LABELS[r.channel] ?? r.channel}</td>
                    <td className="py-2 text-right tabular-nums">{r.count}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(r.revenue, currency)}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(r.grossProfit, currency)}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {r.revenue > 0 ? `${((r.grossProfit / r.revenue) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
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
          Shopify Payments e Eupago mostram o net real (depois das fees).
          PayPal, Stripe e outros usam a revenue bruta da encomenda.
          Eupago só guarda dados dos últimos 3 meses na API — para histórico antigo, importa CSV.
        </p>
      </CardContent>
    </Card>
  );
}

function MonthlyPnLTable({ rows, currency }: { rows: MonthlyPnLRow[]; currency: string }) {
  if (rows.every((r) => r.ecomRevenue === 0 && r.physRevenue === 0)) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>P&L mensal — últimos 6 meses</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b">
            <tr>
              <th className="text-left font-medium py-2">Mês</th>
              <th className="text-right font-medium py-2">Revenue online</th>
              <th className="text-right font-medium py-2">Net profit online</th>
              <th className="text-right font-medium py-2">Revenue físico</th>
              <th className="text-right font-medium py-2">Gross físico</th>
              <th className="text-right font-medium py-2">Despesas</th>
              <th className="text-right font-medium py-2 text-foreground">Net profit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const [yyyy, mm] = r.month.split("-");
              const label = new Date(Number(yyyy), Number(mm) - 1).toLocaleString("pt-PT", {
                month: "short",
                year: "numeric",
              });
              return (
                <tr key={r.month} className="border-b last:border-0">
                  <td className="py-2 font-medium capitalize">{label}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {formatMoney(r.ecomRevenue, currency)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatMoney(r.ecomNetProfit, currency)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {r.physRevenue > 0 ? formatMoney(r.physRevenue, currency) : "—"}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {r.physGrossProfit > 0 ? formatMoney(r.physGrossProfit, currency) : "—"}
                  </td>
                  <td className="py-2 text-right tabular-nums text-destructive">
                    {r.expenses > 0 ? `−${formatMoney(r.expenses, currency)}` : "—"}
                  </td>
                  <td className={`py-2 text-right tabular-nums font-semibold ${r.netProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {formatMoney(r.netProfit, currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-[11px] text-muted-foreground mt-3">
          Net profit = ecom net (pós fees + embalagem + ad spend) + gross físico − despesas registadas.
        </p>
      </CardContent>
    </Card>
  );
}

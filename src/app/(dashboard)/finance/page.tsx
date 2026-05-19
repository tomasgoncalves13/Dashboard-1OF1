import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { getCashflowEntries, getMonthlyCashflow } from "@/lib/finance/cashflow";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { resolveRange } from "@/lib/dashboard/range";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  const store = user ? await prisma.store.findFirst({ where: { ownerId: user.id } }) : null;
  if (!store) return null;

  const sp = await searchParams;
  const range = resolveRange(sp);
  const currency = store.currency;

  const [entries, monthly] = await Promise.all([
    getCashflowEntries(store.id, range.from, range.to),
    getMonthlyCashflow(store.id, 6),
  ]);

  const totalIn = entries.filter((e) => e.type === "IN").reduce((s, e) => s + e.net, 0);
  const totalOut = entries.filter((e) => e.type === "OUT").reduce((s, e) => s + e.amount, 0);
  const netCashflow = totalIn - totalOut;

  // Accounting profit for same period (from orders)
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

  // Monthly cashflow bars (max for scale)
  const maxMonthly = Math.max(...monthly.map((m) => Math.max(m.cashIn, m.cashOut)), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Finance · Cashflow</h1>
        <p className="text-sm text-muted-foreground">{range.label} · dinheiro real que entrou e saiu</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle>Cash in</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-600">{formatMoney(totalIn, currency)}</div>
            <p className="text-xs text-muted-foreground mt-1">Shopify + Eupago (net)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle>Cash out</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-destructive">{formatMoney(totalOut, currency)}</div>
            <p className="text-xs text-muted-foreground mt-1">Despesas + influencers</p>
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

      {/* Cash vs Profit note */}
      {Math.abs(netCashflow - accountingProfit) > 10 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 text-sm">
          <strong>Diferença cashflow vs lucro: {formatMoney(Math.abs(netCashflow - accountingProfit), currency)}</strong>
          <p className="text-muted-foreground mt-1 text-xs">
            Normal — os payouts Shopify têm delay de 2–5 dias úteis.
            Eupago pode ter janelas de liquidação diferentes.
            Despesas de stock não se reflectem em lucro contabilístico da mesma forma.
          </p>
        </div>
      )}

      {/* Monthly cashflow chart (simple bars) */}
      <Card>
        <CardHeader>
          <CardTitle>Cashflow mensal — últimos 6 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 h-40 pt-4">
            {monthly.map((m) => {
              const inH = (m.cashIn / maxMonthly) * 100;
              const outH = (m.cashOut / maxMonthly) * 100;
              const [yyyy, mm] = m.month.split("-");
              const label = new Date(Number(yyyy), Number(mm) - 1).toLocaleString("pt-PT", { month: "short" });
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center gap-0.5 h-28">
                    <div
                      className="w-5 rounded-t bg-emerald-500/70"
                      style={{ height: `${inH}%` }}
                      title={`Cash in: €${m.cashIn.toFixed(0)}`}
                    />
                    <div
                      className="w-5 rounded-t bg-red-400/70"
                      style={{ height: `${outH}%` }}
                      title={`Cash out: €${m.cashOut.toFixed(0)}`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground capitalize">{label}</span>
                  <span className={`text-[10px] font-medium ${m.net >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {m.net >= 0 ? "+" : ""}{formatMoney(m.net, currency)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-emerald-500/70" /> Cash in</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-red-400/70" /> Cash out</span>
          </div>
        </CardContent>
      </Card>

      {/* Entry timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>{entries.length} movimentos no período</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem movimentos no período selecionado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left font-medium py-2">Data</th>
                  <th className="text-left font-medium py-2">Tipo</th>
                  <th className="text-left font-medium py-2">Fonte</th>
                  <th className="text-left font-medium py-2">Descrição</th>
                  <th className="text-right font-medium py-2">Bruto</th>
                  <th className="text-right font-medium py-2">Net / Custo</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 tabular-nums text-muted-foreground text-xs">
                      {e.date.toLocaleDateString("pt-PT")}
                    </td>
                    <td className="py-2">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        e.type === "IN"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                      }`}>
                        {e.type === "IN" ? "Entrada" : "Saída"}
                      </span>
                    </td>
                    <td className="py-2 text-muted-foreground text-xs">{e.source}</td>
                    <td className="py-2">{e.description}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(e.amount, currency)}</td>
                    <td className={`py-2 text-right tabular-nums font-medium ${
                      e.type === "IN" ? "text-emerald-600" : "text-destructive"
                    }`}>
                      {e.type === "IN" ? "+" : "−"}{formatMoney(Math.abs(e.net), currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold border-t">
                  <td colSpan={4} className="pt-3 text-sm">Net cashflow período</td>
                  <td></td>
                  <td className={`pt-3 text-right tabular-nums ${netCashflow >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {netCashflow >= 0 ? "+" : ""}{formatMoney(netCashflow, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

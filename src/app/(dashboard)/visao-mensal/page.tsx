import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getMonthlyOverview, monthCash, monthProfit, type MonthSummary } from "@/lib/dashboard/monthly";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const label = (k: string) => `${MESES[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;
const units = (m: MonthSummary) => m.products.reduce((a, p) => a + p.qty, 0);

export default async function VisaoMensalPage() {
  const user = await getSessionUser();
  const store = user ? await prisma.store.findFirst({ where: { ownerId: user.id } }) : null;
  if (!store) return null;

  const months = await getMonthlyOverview(store.id);
  const money = (v: number) => (v ? formatMoney(v, store.currency) : "—");
  const signed = (v: number) => (
    <span className={`font-semibold ${v < 0 ? "text-destructive" : "text-emerald-600"}`}>{formatMoney(v, store.currency)}</span>
  );
  const sum = (f: (m: MonthSummary) => number) => months.reduce((a, m) => a + f(m), 0);

  const totalProfit = sum(monthProfit);
  const totalCash = sum(monthCash);
  const stockBought = sum((m) => m.stockPurchases);
  const stockUsed = sum((m) => m.cogs + m.physicalCogs);

  let cumProfit = 0;
  let cumCash = 0;
  const rows = months.map((m) => {
    cumProfit += monthProfit(m);
    cumCash += monthCash(m);
    return { m, cumProfit, cumCash };
  });

  const th = "text-right font-medium py-2 px-2 whitespace-nowrap";
  const td = "py-2 px-2 text-right tabular-nums whitespace-nowrap";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visão mensal</h1>
        <p className="text-sm text-muted-foreground">Desde o início · em que meses se ganha ou perde dinheiro</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle>Lucro acumulado</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl">{signed(totalProfit)}</div>
            <p className="text-xs text-muted-foreground mt-1">Conta só o custo das peças que já se venderam</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle>Dinheiro real acumulado</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl">{signed(totalCash)}</div>
            <p className="text-xs text-muted-foreground mt-1">Conta todo o stock comprado, vendido ou não</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle>Stock comprado</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatMoney(stockBought, store.currency)}</div>
            <p className="text-xs text-muted-foreground mt-1">Encomendas a fornecedores, com transporte</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle>Stock ainda por vender (a custo)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatMoney(stockBought - stockUsed, store.currency)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Comprado − custo das peças vendidas ({formatMoney(stockUsed, store.currency)}). É a diferença entre lucro e dinheiro real.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mês a mês</CardTitle>
          <CardDescription>
            Site = encomendas pagas (inclui reembolsadas, como o Shopify; sem PENDING/expiradas). Custo encomendas = produto + embalagem + oferta +
            comissões de pagamento + envio que pagamos. Físicas = vendas a clubes e em mão, menos custo do produto e comissão do clube.
            Despesas fixas = subscrições e software. Outras = despesas pontuais (patente, shooting, etiquetas…) e Academia Ecommerce.
            Dinheiro real = lucro, mas trocando o custo das peças vendidas pelo stock comprado nesse mês. Não inclui IVA.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="text-left font-medium py-2 px-2">Mês</th>
                <th className={th}>Encomendas</th>
                <th className={th}>Líquido site</th>
                <th className={th}>Custo encomendas</th>
                <th className={th}>Anúncios Meta</th>
                <th className={th}>Físicas (líq.)</th>
                <th className={th}>Despesas fixas</th>
                <th className={th}>Outras despesas</th>
                <th className={th}>Lucro do mês</th>
                <th className={th}>Lucro acum.</th>
                <th className={th}>Stock comprado</th>
                <th className={th}>Dinheiro real</th>
                <th className={th}>Dinheiro acum.</th>
                <th className={th}>Ads / encomenda</th>
                <th className={th}>Líquido ÷ ads</th>
                <th className={th}>Ticket médio</th>
                <th className={th}>Unidades</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, cumProfit, cumCash }) => {
                const net = m.gross - m.refunds;
                return (
                  <tr key={m.month} className="border-b last:border-0">
                    <td className="py-2 px-2 whitespace-nowrap">
                      <a href={`#m-${m.month}`} className="underline-offset-2 hover:underline">{label(m.month)}</a>
                    </td>
                    <td className={td}>{m.orders || "—"}</td>
                    <td className={td}>{money(net)}</td>
                    <td className={td}>{money(m.orderCosts)}</td>
                    <td className={td}>{money(m.adSpend)}</td>
                    <td className={td}>{money(m.physicalRevenue - m.physicalCogs - m.physicalCommission)}</td>
                    <td className={td}>{money(m.fixedExpenses)}</td>
                    <td className={td}>{money(m.otherExpenses)}</td>
                    <td className={td}>{signed(monthProfit(m))}</td>
                    <td className={td}>{signed(cumProfit)}</td>
                    <td className={td}>{money(m.stockPurchases)}</td>
                    <td className={td}>{signed(monthCash(m))}</td>
                    <td className={td}>{signed(cumCash)}</td>
                    <td className={td}>{m.adSpend && m.orders ? formatMoney(m.adSpend / m.orders, store.currency) : "—"}</td>
                    <td className={td}>{m.adSpend ? `${(net / m.adSpend).toLocaleString("pt-PT", { maximumFractionDigits: 2 })}×` : "—"}</td>
                    <td className={td}>{m.orders ? formatMoney(m.gross / m.orders, store.currency) : "—"}</td>
                    <td className={td}>{units(m) || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t font-medium">
              <tr>
                <td className="py-2 px-2">Total</td>
                <td className={td}>{sum((m) => m.orders)}</td>
                <td className={td}>{money(sum((m) => m.gross - m.refunds))}</td>
                <td className={td}>{money(sum((m) => m.orderCosts))}</td>
                <td className={td}>{money(sum((m) => m.adSpend))}</td>
                <td className={td}>{money(sum((m) => m.physicalRevenue - m.physicalCogs - m.physicalCommission))}</td>
                <td className={td}>{money(sum((m) => m.fixedExpenses))}</td>
                <td className={td}>{money(sum((m) => m.otherExpenses))}</td>
                <td className={td}>{signed(totalProfit)}</td>
                <td className={td} />
                <td className={td}>{money(stockBought)}</td>
                <td className={td}>{signed(totalCash)}</td>
                <td className={td} colSpan={5} />
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Produtos e variantes por mês</CardTitle>
          <CardDescription>Só encomendas do site.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {months.filter((m) => m.orders).reverse().map((m) => (
            <details key={m.month} id={`m-${m.month}`} className="rounded-md border px-3 py-2">
              <summary className="cursor-pointer text-sm">
                <span className="font-semibold">{label(m.month)}</span>{" "}
                <span className="text-muted-foreground">· {m.orders} encomendas · {formatMoney(m.gross, store.currency)} · {units(m)} unidades</span>
              </summary>
              <table className="w-full text-sm mt-2">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left font-medium py-1">Produto / variante</th>
                    <th className="text-right font-medium py-1">Unidades</th>
                    <th className="text-right font-medium py-1">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {m.products.flatMap((p) => [
                    <tr key={p.title} className="border-b font-medium">
                      <td className="py-1">{p.title}</td>
                      <td className="py-1 text-right tabular-nums">{p.qty}</td>
                      <td className="py-1 text-right tabular-nums">{formatMoney(p.revenue, store.currency)}</td>
                    </tr>,
                    ...p.variants.map((v) => (
                      <tr key={`${p.title}|${v.title}`} className="border-b last:border-0 text-muted-foreground">
                        <td className="py-1 pl-5">{v.title}</td>
                        <td className="py-1 text-right tabular-nums">{v.qty}</td>
                        <td className="py-1 text-right tabular-nums">{formatMoney(v.revenue, store.currency)}</td>
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </details>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

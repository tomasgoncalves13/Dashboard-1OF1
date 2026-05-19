import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveRange } from "@/lib/dashboard/range";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { ExpenseAddDialog } from "./expense-add-dialog";
import { ExpenseList } from "./expense-list";

const CATEGORY_LABELS: Record<string, string> = {
  META_ADS: "Meta Ads",
  GOOGLE_ADS: "Google Ads",
  TIKTOK_ADS: "TikTok Ads",
  SOFTWARE: "Software",
  SHOPIFY_APPS: "Shopify Apps",
  FREELANCERS: "Freelancers",
  SUPPLIERS: "Fornecedores",
  BULK_INVENTORY: "Stock a granel",
  SHIPPING: "Envios",
  PACKAGING: "Embalagem",
  INFLUENCERS: "Influencers",
  SUBSCRIPTIONS: "Subscrições",
  TAXES: "Impostos",
  RENT: "Renda",
  TRAVEL: "Viagens",
  EVENTS: "Eventos",
  MISC: "Outros",
};

export default async function ExpensesPage({
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

  const [expenses, byCategory] = await Promise.all([
    prisma.expense.findMany({
      where: { storeId: store.id, incurredOn: { gte: range.from, lte: range.to } },
      orderBy: { incurredOn: "desc" },
    }),
    prisma.expense.groupBy({
      by: ["category"],
      where: { storeId: store.id, incurredOn: { gte: range.from, lte: range.to } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
  ]);

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">{range.label} · {store.name}</p>
        </div>
        <div className="flex gap-2 flex-wrap items-start">
          <DateRangePicker active={range.preset} />
          <ExpenseAddDialog storeId={store.id} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle>Total despesas</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-destructive">{formatMoney(totalExpenses, currency)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle>Nº despesas</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{expenses.length}</div></CardContent>
        </Card>
      </div>

      {/* By category */}
      {byCategory.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Por categoria</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left font-medium py-2">Categoria</th>
                  <th className="text-right font-medium py-2">Total</th>
                  <th className="text-right font-medium py-2">% do total</th>
                </tr>
              </thead>
              <tbody>
                {byCategory.map((c) => {
                  const amount = Number(c._sum.amount ?? 0);
                  return (
                    <tr key={c.category} className="border-b last:border-0">
                      <td className="py-2">{CATEGORY_LABELS[c.category] ?? c.category}</td>
                      <td className="py-2 text-right tabular-nums">{formatMoney(amount, currency)}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {totalExpenses > 0 ? `${((amount / totalExpenses) * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Full list */}
      <ExpenseList expenses={expenses} currency={currency} categoryLabels={CATEGORY_LABELS} />
    </div>
  );
}

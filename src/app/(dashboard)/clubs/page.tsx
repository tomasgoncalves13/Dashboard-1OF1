import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { getMonthlyClubSummaries } from "@/lib/clubs/service";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ClubCreateDialog } from "./club-create-dialog";
import { SaleRegisterDialog } from "./sale-register-dialog";

export default async function ClubsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getSessionUser();
  const store = user ? await prisma.store.findFirst({ where: { ownerId: user.id } }) : null;
  if (!store) return null;

  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year ?? now.getFullYear());
  const month = Number(sp.month ?? now.getMonth() + 1);

  const [clubs, summaries, rawVariants, recentSales] = await Promise.all([
    prisma.club.findMany({ where: { storeId: store.id }, orderBy: { name: "asc" } }),
    getMonthlyClubSummaries(store.id, year, month),
    prisma.productVariant.findMany({
      where: {
        product: { storeId: store.id, status: "ACTIVE" },
        components: { some: {} },
      },
      select: {
        id: true,
        unitCost: true,
        title: true,
        components: {
          select: {
            quantity: true,
            inventoryItem: { select: { id: true, name: true, family: true, stockOnHand: true, unitCost: true } },
          },
        },
        product: { select: { title: true } },
      },
    }),
    prisma.manualSale.findMany({
      where: { storeId: store.id },
      orderBy: { soldAt: "desc" },
      take: 20,
      include: {
        club: { select: { name: true } },
        items: { include: { variant: { select: { title: true, product: { select: { title: true } } } } } },
      },
    }),
  ]);

  // Only show simple inventory items (1 component, qty=1), deduplicated by inventoryItemId.
  // Bundles and duplicates are excluded — each physical item appears exactly once.
  const seenInventoryItems = new Set<string>();
  const inventoryProducts = rawVariants
    .flatMap((v) => {
      if (v.components.length !== 1 || v.components[0].quantity !== 1) return [];
      const comp = v.components[0].inventoryItem;
      if (seenInventoryItems.has(comp.id)) return [];
      seenInventoryItems.add(comp.id);
      return [{
        variantId: v.id,
        name: comp.name,
        family: comp.family,
        stockOnHand: comp.stockOnHand,
        unitCost: Number(v.unitCost ?? comp.unitCost ?? 0),
      }];
    })
    .sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name));

  const currency = store.currency;
  const monthLabel = new Date(year, month - 1).toLocaleString("pt-PT", { month: "long", year: "numeric" });

  const totalRevenue = summaries.reduce((s, r) => s + r.revenue, 0);
  const totalProfit = summaries.reduce((s, r) => s + r.netProfit, 0);
  const totalCommission = summaries.reduce((s, r) => s + r.commission, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Physical Sales</h1>
          <p className="text-sm text-muted-foreground">Clubes, vendas próprias e eventos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <SaleRegisterDialog clubs={clubs} inventoryProducts={inventoryProducts} currency={currency} />
          <ClubCreateDialog />
        </div>
      </div>

      {/* Month picker */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Mês:</span>
        <MonthNav year={year} month={month} />
      </div>

      {/* Monthly KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Revenue físico", value: formatMoney(totalRevenue, currency) },
          { label: "Lucro líquido", value: formatMoney(totalProfit, currency) },
          { label: "Comissões clubes", value: formatMoney(totalCommission, currency) },
          {
            label: "Margem",
            value: totalRevenue > 0 ? `${((totalProfit / totalRevenue) * 100).toFixed(1)}%` : "—",
          },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2"><CardTitle>{k.label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-semibold">{k.value}</div></CardContent>
          </Card>
        ))}
      </div>

      {/* Per-club summary */}
      {summaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Por clube — {monthLabel}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left font-medium py-2">Clube</th>
                  <th className="text-right font-medium py-2">Revenue</th>
                  <th className="text-right font-medium py-2">COGS</th>
                  <th className="text-right font-medium py-2">Gross profit</th>
                  <th className="text-right font-medium py-2">Comissão</th>
                  <th className="text-right font-medium py-2">Net profit</th>
                  <th className="text-right font-medium py-2">Margem</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.clubId} className="border-b last:border-0">
                    <td className="py-2 font-medium">{s.clubName}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(s.revenue, currency)}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{formatMoney(s.cogs, currency)}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(s.grossProfit, currency)}</td>
                    <td className="py-2 text-right tabular-nums text-orange-500">{formatMoney(s.commission, currency)}</td>
                    <td className="py-2 text-right tabular-nums font-semibold">{formatMoney(s.netProfit, currency)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {s.revenue > 0 ? `${((s.netProfit / s.revenue) * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <Link href={`/clubs/${s.clubId}`} className="text-xs text-muted-foreground hover:text-foreground">
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Recent sales */}
      <Card>
        <CardHeader><CardTitle>Vendas recentes</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {recentSales.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem vendas registadas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left font-medium py-2">Data</th>
                  <th className="text-left font-medium py-2">Canal</th>
                  <th className="text-left font-medium py-2">Itens</th>
                  <th className="text-right font-medium py-2">Total</th>
                  <th className="text-right font-medium py-2">Lucro</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale) => (
                  <tr key={sale.id} className="border-b last:border-0">
                    <td className="py-2 tabular-nums text-muted-foreground text-xs">
                      {sale.soldAt.toLocaleDateString("pt-PT")}
                    </td>
                    <td className="py-2">
                      {sale.club ? sale.club.name : channelLabel(sale.channel)}
                    </td>
                    <td className="py-2 text-muted-foreground text-xs">
                      {sale.items.map((i) =>
                        `${i.quantity}× ${i.variant.product.title} ${i.variant.title}`
                      ).join(", ")}
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(Number(sale.total), currency)}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(Number(sale.grossProfit), currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function channelLabel(ch: string) {
  const map: Record<string, string> = {
    MANUAL: "Venda própria",
    CLUB: "Clube",
    EVENT: "Evento",
    POPUP: "Popup",
    WHOLESALE: "Wholesale",
    INFLUENCER_GIFT: "Influencer",
  };
  return map[ch] ?? ch;
}

function MonthNav({ year, month }: { year: number; month: number }) {
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const label = new Date(year, month - 1).toLocaleString("pt-PT", { month: "long", year: "numeric" });
  return (
    <div className="flex items-center gap-3">
      <Link
        href={`/clubs?year=${prev.year}&month=${prev.month}`}
        className="text-muted-foreground hover:text-foreground"
      >
        ‹
      </Link>
      <span className="font-medium capitalize">{label}</span>
      <Link
        href={`/clubs?year=${next.year}&month=${next.month}`}
        className="text-muted-foreground hover:text-foreground"
      >
        ›
      </Link>
    </div>
  );
}

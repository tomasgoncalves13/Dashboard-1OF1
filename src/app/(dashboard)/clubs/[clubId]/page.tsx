import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { getClub, getMonthlyClubSummaries } from "@/lib/clubs/service";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClubPricingTable } from "./club-pricing-table";
import { CommissionConfig } from "./commission-config";

export default async function ClubDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getSessionUser();
  const store = user ? await prisma.store.findFirst({ where: { ownerId: user.id } }) : null;
  if (!store) return null;

  const { clubId } = await params;
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year ?? now.getFullYear());
  const month = Number(sp.month ?? now.getMonth() + 1);

  const [club, products, summaries, sales] = await Promise.all([
    getClub(store.id, clubId),
    prisma.product.findMany({
      where: { storeId: store.id, status: "ACTIVE" },
      select: { id: true, title: true, imageUrl: true },
      orderBy: { title: "asc" },
    }),
    getMonthlyClubSummaries(store.id, year, month),
    prisma.manualSale.findMany({
      where: { storeId: store.id, clubId },
      orderBy: { soldAt: "desc" },
      take: 50,
      include: {
        items: {
          include: {
            variant: {
              select: { title: true, product: { select: { title: true } } },
            },
          },
        },
      },
    }),
  ]);

  if (!club) notFound();

  const summary = summaries.find((s) => s.clubId === clubId);
  const currency = store.currency;
  const monthLabel = new Date(year, month - 1).toLocaleString("pt-PT", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/clubs" className="text-xs text-muted-foreground hover:text-foreground">← Clubes</Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">{club.name}</h1>
          <p className="text-sm text-muted-foreground">
            {club.commissionEnabled ? "Comissão progressiva activa" : "Sem comissão"}
            {" · "}
            {club.isActive ? "Ativo" : "Inativo"}
          </p>
        </div>
      </div>

      {/* Monthly summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Revenue", value: formatMoney(summary.revenue, currency) },
            { label: "COGS", value: formatMoney(summary.cogs, currency) },
            { label: "Gross profit", value: formatMoney(summary.grossProfit, currency) },
            { label: `Comissão (${monthLabel})`, value: formatMoney(summary.commission, currency) },
            { label: "Net profit", value: formatMoney(summary.netProfit, currency) },
          ].map((k) => (
            <Card key={k.label}>
              <CardHeader className="pb-1"><CardTitle className="text-xs">{k.label}</CardTitle></CardHeader>
              <CardContent><div className="text-xl font-semibold">{k.value}</div></CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pricing config */}
        <Card>
          <CardHeader>
            <CardTitle>Preços por produto</CardTitle>
            <CardDescription>Preço de venda deste clube. Clica para editar.</CardDescription>
          </CardHeader>
          <CardContent>
            <ClubPricingTable
              clubId={club.id}
              products={products}
              existingPrices={club.productPrices}
              currency={currency}
            />
          </CardContent>
        </Card>

        {/* Commission config */}
        <Card>
          <CardHeader>
            <CardTitle>Comissão</CardTitle>
            <CardDescription>
              Tiers progressivos mensais. Primeira banda a 25%, segunda a 30%, acima a 35%.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CommissionConfig
              clubId={club.id}
              commissionEnabled={club.commissionEnabled}
              commissionTiers={club.commissionTiers}
            />
          </CardContent>
        </Card>
      </div>

      {/* Sales history */}
      <Card>
        <CardHeader><CardTitle>Histórico de vendas</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {sales.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem vendas registadas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left font-medium py-2">Data</th>
                  <th className="text-left font-medium py-2">Itens</th>
                  <th className="text-right font-medium py-2">Revenue</th>
                  <th className="text-right font-medium py-2">COGS</th>
                  <th className="text-right font-medium py-2">Gross profit</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id} className="border-b last:border-0">
                    <td className="py-2 tabular-nums text-muted-foreground text-xs">
                      {sale.soldAt.toLocaleDateString("pt-PT")}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {sale.items.map((i) =>
                        `${i.quantity}× ${i.variant.product.title} ${i.variant.title}`
                      ).join(", ")}
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(Number(sale.total), currency)}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{formatMoney(Number(sale.cogsTotal), currency)}</td>
                    <td className="py-2 text-right tabular-nums font-medium">{formatMoney(Number(sale.grossProfit), currency)}</td>
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

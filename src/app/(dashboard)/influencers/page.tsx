import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfluencerAddDialog } from "./influencer-add-dialog";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  PROSPECT: "Prospecto",
  CONTACTED: "Contactado",
  ACTIVE: "Activo",
  COMPLETED: "Concluído",
  PAUSED: "Pausado",
  BLACKLIST: "Blacklist",
};

const STATUS_COLORS: Record<string, string> = {
  PROSPECT: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  CONTACTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  COMPLETED: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  PAUSED: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  BLACKLIST: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

export default async function InfluencersPage() {
  const user = await getSessionUser();
  const store = user ? await prisma.store.findFirst({ where: { ownerId: user.id } }) : null;
  if (!store) return null;

  const influencers = await prisma.influencer.findMany({
    where: { storeId: store.id },
    include: {
      shipments: {
        include: { items: { select: { unitCost: true, quantity: true } } },
      },
      payments: { select: { amount: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  const currency = store.currency;

  // Stats
  const active = influencers.filter((i) => i.status === "ACTIVE").length;
  const totalRevenue = influencers.reduce((s, i) => s + Number(i.attributedRevenue), 0);
  const totalCost = influencers.reduce((s, i) => {
    const productCost = i.shipments.reduce(
      (ss, sh) => ss + sh.items.reduce((sss, it) => sss + Number(it.unitCost) * it.quantity, 0) + Number(sh.shippingCost),
      0,
    );
    const payments = i.payments.reduce((ss, p) => ss + Number(p.amount), 0);
    return s + productCost + payments;
  }, 0);
  const totalROI = totalRevenue - totalCost;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Influencers</h1>
          <p className="text-sm text-muted-foreground">Pipeline, envios e ROI</p>
        </div>
        <InfluencerAddDialog storeId={store.id} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total influencers", value: influencers.length.toString() },
          { label: "Activos", value: active.toString() },
          { label: "Revenue atribuído", value: formatMoney(totalRevenue, currency) },
          {
            label: "ROI total",
            value: formatMoney(totalROI, currency),
            positive: totalROI >= 0,
          },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2"><CardTitle>{k.label}</CardTitle></CardHeader>
            <CardContent>
              <div className={`text-2xl font-semibold ${"positive" in k ? (k.positive ? "text-emerald-600" : "text-destructive") : ""}`}>
                {k.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline board (grouped by status) */}
      {(["PROSPECT", "CONTACTED", "ACTIVE", "COMPLETED", "PAUSED", "BLACKLIST"] as const).map((status) => {
        const group = influencers.filter((i) => i.status === status);
        if (group.length === 0) return null;
        return (
          <div key={status}>
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${STATUS_COLORS[status]}`}>
                {STATUS_LABELS[status]}
              </span>
              <span className="text-muted-foreground">({group.length})</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.map((inf) => {
                const productCost = inf.shipments.reduce(
                  (s, sh) => s + sh.items.reduce((ss, it) => ss + Number(it.unitCost) * it.quantity, 0) + Number(sh.shippingCost),
                  0,
                );
                const payments = inf.payments.reduce((s, p) => s + Number(p.amount), 0);
                const totalInfCost = productCost + payments;
                const revenue = Number(inf.attributedRevenue);
                const roi = revenue - totalInfCost;
                return (
                  <Card key={inf.id} className="hover:bg-accent/20 transition-colors">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{inf.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {inf.handle ? `@${inf.handle}` : ""}
                            {inf.platform ? ` · ${inf.platform}` : ""}
                            {inf.followers ? ` · ${(inf.followers / 1000).toFixed(1)}k` : ""}
                          </p>
                        </div>
                        {inf.discountCode && (
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                            {inf.discountCode}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-1 text-xs">
                        <div>
                          <p className="text-muted-foreground">Custo</p>
                          <p className="font-medium tabular-nums">{formatMoney(totalInfCost, currency)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Revenue</p>
                          <p className="font-medium tabular-nums">{formatMoney(revenue, currency)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">ROI</p>
                          <p className={`font-semibold tabular-nums ${roi >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {roi >= 0 ? "+" : ""}{formatMoney(roi, currency)}
                          </p>
                        </div>
                      </div>
                      {inf.shipments.length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-2">
                          {inf.shipments.length} envio(s) · último: {inf.shipments[inf.shipments.length - 1]?.status}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

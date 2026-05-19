import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfluencerAddDialog } from "./influencer-add-dialog";
import { InfluencerCard } from "./influencer-card";

const STATUS_ORDER = ["PROSPECT", "CONTACTED", "ACTIVE", "COMPLETED", "PAUSED", "BLACKLIST"];
const STATUS_LABELS: Record<string, string> = {
  PROSPECT: "Prospecto",
  CONTACTED: "Contactado",
  ACTIVE: "Activo",
  COMPLETED: "Concluído",
  PAUSED: "Pausado",
  BLACKLIST: "Blacklist",
};

export default async function InfluencersPage() {
  const user = await getSessionUser();
  const store = user ? await prisma.store.findFirst({ where: { ownerId: user.id } }) : null;
  if (!store) return null;

  const [influencers, products] = await Promise.all([
    prisma.influencer.findMany({
      where: { storeId: store.id },
      include: {
        shipments: {
          include: { items: { select: { unitCost: true, quantity: true } } },
          orderBy: { createdAt: "asc" },
        },
        payments: { select: { amount: true } },
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    prisma.product.findMany({
      where: { storeId: store.id, status: "ACTIVE" },
      select: {
        id: true,
        title: true,
        variants: {
          select: { id: true, title: true, unitCost: true, stockOnHand: true },
          orderBy: { title: "asc" },
        },
      },
      orderBy: { title: "asc" },
    }),
  ]);

  const currency = store.currency;

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

      {STATUS_ORDER.map((status) => {
        const group = influencers.filter((i) => i.status === status);
        if (group.length === 0) return null;
        return (
          <div key={status}>
            <h2 className="text-sm font-semibold mb-2 text-muted-foreground">
              {STATUS_LABELS[status]} ({group.length})
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.map((inf) => (
                <InfluencerCard
                  key={inf.id}
                  influencer={inf}
                  currency={currency}
                  products={products}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

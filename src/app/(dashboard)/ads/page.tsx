import { getAdAccountInsights, getAdAccountInsightsDaily, getCampaignInsights } from "@/lib/meta/graph";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpendChart } from "./spend-chart";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

function dateSince(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtMoney(v: string | number) {
  return `€${Number(v).toFixed(2)}`;
}

function fmtPct(v: string | number) {
  return `${Number(v).toFixed(2)}%`;
}

function fmtNum(v: string | number) {
  return Number(v).toLocaleString("pt-PT");
}

function roas(insight: { purchase_roas?: { action_type: string; value: string }[] } | null) {
  if (!insight?.purchase_roas?.length) return null;
  const r = insight.purchase_roas.find((x) => x.action_type === "omni_purchase");
  return r ? Number(r.value).toFixed(2) : null;
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-700",
    PAUSED: "bg-yellow-100 text-yellow-700",
    DELETED: "bg-red-100 text-red-700",
    ARCHIVED: "bg-gray-100 text-gray-500",
  };
  const s = status ?? "UNKNOWN";
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${map[s] ?? "bg-gray-100 text-gray-500"}`}>
      {s === "ACTIVE" ? "Ativa" : s === "PAUSED" ? "Pausada" : s === "ARCHIVED" ? "Arquivada" : s}
    </span>
  );
}

export default async function AdsPage() {
  const since30 = dateSince(30);
  const since7 = dateSince(7);
  const until = today();

  let error: string | null = null;
  let insight30: Awaited<ReturnType<typeof getAdAccountInsights>> = null;
  let insight7: Awaited<ReturnType<typeof getAdAccountInsights>> = null;
  let daily: Awaited<ReturnType<typeof getAdAccountInsightsDaily>> = [];
  let campaigns: Awaited<ReturnType<typeof getCampaignInsights>> = [];

  try {
    [insight30, insight7, daily, campaigns] = await Promise.all([
      getAdAccountInsights(since30, until),
      getAdAccountInsights(since7, until),
      getAdAccountInsightsDaily(since30, until),
      getCampaignInsights(since30, until),
    ]);
  } catch (e) {
    error = (e as Error).message;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Facebook Ads</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const spend30 = Number(insight30?.spend ?? 0);
  const spend7 = Number(insight7?.spend ?? 0);
  const roasVal = roas(insight30);

  const chartData = daily.map((d) => ({
    date: d.date_start,
    spend: Number(d.spend),
  }));

  const kpis = [
    { label: "Gasto (30d)", value: fmtMoney(spend30) },
    { label: "Gasto (7d)", value: fmtMoney(spend7) },
    { label: "Impressões (30d)", value: fmtNum(insight30?.impressions ?? 0) },
    { label: "Cliques (30d)", value: fmtNum(insight30?.clicks ?? 0) },
    { label: "CTR (30d)", value: fmtPct(insight30?.ctr ?? 0) },
    { label: "CPC (30d)", value: fmtMoney(insight30?.cpc ?? 0) },
    { label: "CPM (30d)", value: fmtMoney(insight30?.cpm ?? 0) },
    { label: "ROAS (30d)", value: roasVal ? `${roasVal}×` : "—" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Facebook Ads</h1>
        <p className="text-sm text-muted-foreground">Conta 1OF1 Fútbol · últimos 30 dias</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Spend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Gasto diário (últimos 30 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <SpendChart data={chartData} />
        </CardContent>
      </Card>

      {/* Campaigns Table */}
      <div>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
          Campanhas ({campaigns.length})
        </h2>
        {campaigns.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Sem campanhas com dados no período selecionado.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-3 font-medium">Campanha</th>
                      <th className="text-right px-4 py-3 font-medium">Gasto</th>
                      <th className="text-right px-4 py-3 font-medium">Impressões</th>
                      <th className="text-right px-4 py-3 font-medium">Cliques</th>
                      <th className="text-right px-4 py-3 font-medium">CTR</th>
                      <th className="text-right px-4 py-3 font-medium">CPC</th>
                      <th className="text-right px-4 py-3 font-medium">Alcance</th>
                      <th className="text-right px-4 py-3 font-medium">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c, i) => {
                      const r = roas(c);
                      return (
                        <tr key={c.campaign_id} className={i % 2 === 0 ? "" : "bg-muted/30"}>
                          <td className="px-4 py-3">
                            <div className="font-medium truncate max-w-[200px]">{c.campaign_name}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-medium">{fmtMoney(c.spend)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{fmtNum(c.impressions)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{fmtNum(c.clicks)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{fmtPct(c.ctr)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{fmtMoney(c.cpc)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{fmtNum(c.reach)}</td>
                          <td className="px-4 py-3 text-right">
                            {r ? (
                              <span className={`font-medium ${Number(r) >= 2 ? "text-emerald-600" : Number(r) >= 1 ? "text-yellow-600" : "text-destructive"}`}>
                                {r}×
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

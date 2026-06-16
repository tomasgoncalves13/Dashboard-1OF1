import { getAdAccountInsights, getAdAccountInsightsDaily, getCampaignInsights } from "@/lib/google-ads/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpendChart } from "../spend-chart";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { resolveRange, ymd } from "@/lib/dashboard/range";

function fmtMoney(v: number) {
  return `€${v.toFixed(2)}`;
}

function fmtPct(v: number) {
  return `${v.toFixed(2)}%`;
}

function fmtNum(v: number) {
  return v.toLocaleString("pt-PT");
}

export default async function GoogleAdsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const range = resolveRange(sp);
  const since = ymd(range.from);
  const until = ymd(range.to);

  let error: string | null = null;
  let insight: Awaited<ReturnType<typeof getAdAccountInsights>> | null = null;
  let daily: Awaited<ReturnType<typeof getAdAccountInsightsDaily>> = [];
  let campaigns: Awaited<ReturnType<typeof getCampaignInsights>> = [];

  try {
    [insight, daily, campaigns] = await Promise.all([
      getAdAccountInsights(since, until),
      getAdAccountInsightsDaily(since, until),
      getCampaignInsights(since, until),
    ]);
  } catch (e) {
    error = (e as Error).message;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Google Ads</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roasVal = insight && insight.spend > 0 ? (insight.conversionsValue / insight.spend).toFixed(2) : null;

  const chartData = daily.map((d) => ({
    date: d.date ?? "",
    spend: d.spend,
  }));

  const kpis = [
    { label: "Gasto", value: fmtMoney(insight?.spend ?? 0) },
    { label: "Impressões", value: fmtNum(insight?.impressions ?? 0) },
    { label: "Cliques", value: fmtNum(insight?.clicks ?? 0) },
    { label: "CTR", value: fmtPct(insight?.ctr ?? 0) },
    { label: "CPC", value: fmtMoney(insight?.cpc ?? 0) },
    { label: "Conversões", value: fmtNum(insight?.conversions ?? 0) },
    { label: "Valor Conversões", value: fmtMoney(insight?.conversionsValue ?? 0) },
    { label: "ROAS", value: roasVal ? `${roasVal}×` : "—" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Google Ads</h1>
          <p className="text-sm text-muted-foreground">Conta 1OF1 Fútbol · {range.label}</p>
        </div>
        <DateRangePicker active={range.preset} />
      </div>

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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Gasto diário</CardTitle>
        </CardHeader>
        <CardContent>
          <SpendChart data={chartData} />
        </CardContent>
      </Card>

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
                      <th className="text-right px-4 py-3 font-medium">Conversões</th>
                      <th className="text-right px-4 py-3 font-medium">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c, i) => {
                      const r = c.spend > 0 ? (c.conversionsValue / c.spend).toFixed(2) : null;
                      return (
                        <tr key={c.campaignId} className={i % 2 === 0 ? "" : "bg-muted/30"}>
                          <td className="px-4 py-3">
                            <div className="font-medium truncate max-w-[200px]">{c.campaignName}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-medium">{fmtMoney(c.spend)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{fmtNum(c.impressions)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{fmtNum(c.clicks)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{fmtPct(c.ctr)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{fmtMoney(c.cpc)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{fmtNum(c.conversions)}</td>
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

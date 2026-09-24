import { prisma } from "@/lib/prisma";
import { getCampaignInsightsDaily } from "@/lib/meta/graph";

const purchase = (list: { action_type: string; value: string }[] | undefined) =>
  Number(list?.find((a) => a.action_type === "purchase")?.value ?? 0);

/** Guarda o gasto diário de cada campanha Meta em AdCampaign/AdMetric (idempotente). */
export async function syncMetaAdSpend(storeId: string, since: string, until: string) {
  const rows = await getCampaignInsightsDaily(since, until);
  const campaignIds = new Map<string, string>();
  for (const r of rows) {
    if (!campaignIds.has(r.campaign_id)) {
      const c = await prisma.adCampaign.upsert({
        where: { storeId_provider_externalId: { storeId, provider: "META", externalId: r.campaign_id } },
        create: { storeId, provider: "META", externalId: r.campaign_id, name: r.campaign_name },
        update: { name: r.campaign_name },
      });
      campaignIds.set(r.campaign_id, c.id);
    }
    const campaignId = campaignIds.get(r.campaign_id)!;
    const date = new Date(`${r.date_start}T00:00:00Z`);
    const data = {
      spend: Number(r.spend),
      impressions: Number(r.impressions),
      clicks: Number(r.clicks),
      purchases: purchase(r.actions),
      attributedRevenue: purchase(r.action_values),
    };
    await prisma.adMetric.upsert({
      where: { campaignId_date: { campaignId, date } },
      create: { campaignId, date, ...data },
      update: data,
    });
  }
  return { rows: rows.length, campaigns: campaignIds.size };
}

/** Gasto Meta guardado entre duas datas (inclusive). */
export async function getStoredMetaAdSpend(storeId: string, from: Date, to: Date) {
  const agg = await prisma.adMetric.aggregate({
    where: { campaign: { storeId, provider: "META" }, date: { gte: from, lte: to } },
    _sum: { spend: true },
  });
  return Number(agg._sum.spend ?? 0);
}

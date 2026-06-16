const API_VERSION = "v18";
const BASE = `https://googleads.googleapis.com/${API_VERSION}`;

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Google Ads OAuth não configurado");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? "Falha ao obter access token Google Ads");

  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

function customerId(): string {
  const id = process.env.GOOGLE_ADS_CUSTOMER_ID;
  if (!id) throw new Error("GOOGLE_ADS_CUSTOMER_ID não configurado");
  return id;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GAQLRow = Record<string, any>;

async function search(query: string): Promise<GAQLRow[]> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN não configurado");
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

  const token = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

  const res = await fetch(`${BASE}/customers/${customerId()}/googleAds:searchStream`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
    next: { revalidate: 300 },
  });
  const data = await res.json();
  if (!res.ok) {
    const message = data?.[0]?.error?.message ?? data?.error?.message ?? JSON.stringify(data);
    throw new Error(message);
  }

  const batches: { results?: GAQLRow[] }[] = Array.isArray(data) ? data : [data];
  return batches.flatMap((b) => b.results ?? []);
}

function microsToCurrency(micros: string | number | undefined): number {
  return Number(micros ?? 0) / 1_000_000;
}

export interface AdsInsight {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversionsValue: number;
  date?: string;
}

function sumRows(rows: GAQLRow[]): AdsInsight {
  let costMicros = 0, impressions = 0, clicks = 0, conversions = 0, conversionsValue = 0;
  for (const r of rows) {
    costMicros += Number(r.metrics?.costMicros ?? 0);
    impressions += Number(r.metrics?.impressions ?? 0);
    clicks += Number(r.metrics?.clicks ?? 0);
    conversions += Number(r.metrics?.conversions ?? 0);
    conversionsValue += Number(r.metrics?.conversionsValue ?? 0);
  }
  const spend = microsToCurrency(costMicros);
  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    conversions,
    conversionsValue,
  };
}

export async function getAdAccountInsights(since: string, until: string): Promise<AdsInsight> {
  const rows = await search(`
    SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value
    FROM customer
    WHERE segments.date BETWEEN '${since}' AND '${until}'
  `);
  return sumRows(rows);
}

export async function getAdAccountInsightsDaily(since: string, until: string): Promise<AdsInsight[]> {
  const rows = await search(`
    SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value
    FROM customer
    WHERE segments.date BETWEEN '${since}' AND '${until}'
    ORDER BY segments.date ASC
  `);
  return rows.map((r) => ({ ...sumRows([r]), date: r.segments?.date }));
}

export interface CampaignInsight extends AdsInsight {
  campaignId: string;
  campaignName: string;
  status: string;
}

export async function getCampaignInsights(since: string, until: string): Promise<CampaignInsight[]> {
  const rows = await search(`
    SELECT campaign.id, campaign.name, campaign.status, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${since}' AND '${until}'
  `);

  const byCampaign = new Map<string, { name: string; status: string; rows: GAQLRow[] }>();
  for (const r of rows) {
    const id = String(r.campaign?.id);
    const entry = byCampaign.get(id);
    if (entry) entry.rows.push(r);
    else byCampaign.set(id, { name: r.campaign?.name, status: r.campaign?.status, rows: [r] });
  }

  return Array.from(byCampaign.entries())
    .map(([campaignId, { name, status, rows }]) => ({
      campaignId,
      campaignName: name,
      status,
      ...sumRows(rows),
    }))
    .sort((a, b) => b.spend - a.spend);
}

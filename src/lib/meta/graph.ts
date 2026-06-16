const BASE = "https://graph.facebook.com/v21.0";

async function get<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

async function metaPost<T>(path: string, token: string, body: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

function systemToken() {
  const t = process.env.META_PAGE_ACCESS_TOKEN;
  if (!t) throw new Error("META_PAGE_ACCESS_TOKEN não configurado");
  return t;
}

function adsToken() {
  const t = process.env.META_ACCESS_TOKEN;
  if (!t) throw new Error("META_ACCESS_TOKEN não configurado");
  return t;
}

function adAccountPath() {
  const id = process.env.META_AD_ACCOUNT_ID;
  if (!id) throw new Error("META_AD_ACCOUNT_ID não configurado");
  return `/act_${id}`;
}

export interface AdsInsight {
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  cpm: string;
  reach: string;
  frequency: string;
  purchase_roas?: { action_type: string; value: string }[];
  date_start: string;
  date_stop: string;
}

export interface CampaignInsight {
  campaign_id: string;
  campaign_name: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  reach: string;
  purchase_roas?: { action_type: string; value: string }[];
  effective_status?: string;
  objective?: string;
}

export async function getAdAccountInsights(since: string, until: string): Promise<AdsInsight | null> {
  const data = await get<{ data: AdsInsight[] }>(`${adAccountPath()}/insights`, adsToken(), {
    fields: "spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,purchase_roas,date_start,date_stop",
    time_range: JSON.stringify({ since, until }),
    level: "account",
  });
  return data.data[0] ?? null;
}

export async function getAdAccountInsightsDaily(since: string, until: string): Promise<AdsInsight[]> {
  const data = await get<{ data: AdsInsight[] }>(`${adAccountPath()}/insights`, adsToken(), {
    fields: "spend,impressions,clicks,ctr,cpc,date_start,date_stop",
    time_range: JSON.stringify({ since, until }),
    time_increment: "1",
    level: "account",
  });
  return data.data;
}

export async function getCampaignInsights(since: string, until: string): Promise<CampaignInsight[]> {
  const data = await get<{ data: CampaignInsight[] }>(`${adAccountPath()}/insights`, adsToken(), {
    fields: "campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,reach,purchase_roas",
    time_range: JSON.stringify({ since, until }),
    level: "campaign",
    sort: "spend_descending",
  });
  return data.data;
}

export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
  category: string;
}

export const PAGE_ID = "501834049687066";

export async function getPages(): Promise<MetaPage[]> {
  const data = await get<{ data: MetaPage[] }>("/me/accounts", systemToken(), {
    fields: "id,name,access_token,category",
  });
  // Use system token as fallback if page token is not returned
  return data.data.map((p) => ({ ...p, access_token: p.access_token || systemToken() }));
}

export interface PageInfo {
  id: string;
  name: string;
  fan_count: number;
  followers_count: number;
  instagram_business_account?: {
    id: string;
    username: string;
    followers_count: number;
    media_count: number;
    profile_picture_url: string;
    biography: string;
  };
}

export async function getPageInfo(pageId: string, pageToken: string): Promise<PageInfo> {
  return get<PageInfo>(`/${pageId}`, pageToken, {
    fields: "id,name,fan_count,followers_count,instagram_business_account{id,username,followers_count,media_count,profile_picture_url,biography}",
  });
}

export interface PagePost {
  id: string;
  message?: string;
  story?: string;
  created_time: string;
  full_picture?: string;
  permalink_url: string;
  reactions: { summary: { total_count: number } };
  comments: { summary: { total_count: number } };
  shares?: { count: number };
}

export async function getPagePosts(pageId: string, pageToken: string, limit = 15): Promise<PagePost[]> {
  const data = await get<{ data: PagePost[] }>(`/${pageId}/feed`, pageToken, {
    fields: "id,message,story,created_time,full_picture,permalink_url,reactions.summary(true),comments.summary(true),shares",
    limit: limit.toString(),
  });
  return data.data;
}

export interface IgMedia {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REELS";
  media_url?: string;
  thumbnail_url?: string;
  timestamp: string;
  like_count: number;
  comments_count: number;
  permalink: string;
}

export async function getIgMedia(igId: string, pageToken: string, limit = 12): Promise<IgMedia[]> {
  const data = await get<{ data: IgMedia[] }>(`/${igId}/media`, pageToken, {
    fields: "id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,permalink",
    limit: limit.toString(),
  });
  return data.data;
}

export async function getIgInsights(igId: string, pageToken: string) {
  const since = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
  const until = Math.floor(Date.now() / 1000);
  const data = await get<{ data: { name: string; values: { value: number; end_time: string }[] }[] }>(
    `/${igId}/insights`,
    pageToken,
    { metric: "follower_count,reach,impressions,profile_views", period: "day", since: since.toString(), until: until.toString() },
  );
  return data.data;
}

export async function publishIgMedia(
  igId: string,
  pageToken: string,
  params: { imageUrl?: string; videoUrl?: string; caption: string; isReel?: boolean; scheduledTime?: number },
): Promise<string> {
  const body: Record<string, string> = { caption: params.caption };
  if (params.imageUrl) body.image_url = params.imageUrl;
  if (params.videoUrl) { body.video_url = params.videoUrl; body.media_type = "REELS"; }
  if (params.scheduledTime) { body.published = "false"; body.scheduled_publish_time = params.scheduledTime.toString(); }
  const container = await metaPost<{ id: string }>(`/${igId}/media`, pageToken, body);
  if (params.scheduledTime) return container.id;
  const result = await metaPost<{ id: string }>(`/${igId}/media_publish`, pageToken, { creation_id: container.id });
  return result.id;
}

export async function publishFbPost(
  pageId: string,
  pageToken: string,
  params: { message: string; link?: string; scheduledTime?: number },
): Promise<string> {
  const body: Record<string, string> = { message: params.message };
  if (params.link) body.link = params.link;
  if (params.scheduledTime) { body.published = "false"; body.scheduled_publish_time = params.scheduledTime.toString(); }
  const result = await metaPost<{ id: string }>(`/${pageId}/feed`, pageToken, body);
  return result.id;
}

const BASE = "https://open.tiktokapis.com/v2";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const refreshToken = process.env.TIKTOK_REFRESH_TOKEN;
  if (!clientKey || !clientSecret || !refreshToken) throw new Error("TikTok OAuth não configurado");

  const res = await fetch(`${BASE}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description ?? data.error);

  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json();
  if (data.error && data.error.code && data.error.code !== "ok") {
    throw new Error(data.error.message ?? data.error.code);
  }
  return data;
}

export interface TikTokUserInfo {
  openId: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  likesCount: number;
  videoCount: number;
}

export async function getUserInfo(): Promise<TikTokUserInfo> {
  const fields = "open_id,display_name,avatar_url,follower_count,following_count,likes_count,video_count";
  const data = await api<{ data: { user: TikTokUserInfo & Record<string, unknown> } }>(`/user/info/?fields=${fields}`);
  const u = data.data.user as Record<string, unknown>;
  return {
    openId: u.open_id as string,
    displayName: u.display_name as string,
    avatarUrl: u.avatar_url as string,
    followerCount: (u.follower_count as number) ?? 0,
    followingCount: (u.following_count as number) ?? 0,
    likesCount: (u.likes_count as number) ?? 0,
    videoCount: (u.video_count as number) ?? 0,
  };
}

export interface TikTokVideo {
  id: string;
  title: string;
  coverImageUrl: string;
  shareUrl: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  createTime: number;
}

export async function getVideoList(maxCount = 12): Promise<TikTokVideo[]> {
  const fields = "id,title,cover_image_url,share_url,view_count,like_count,comment_count,share_count,create_time";
  const data = await api<{ data: { videos: Record<string, unknown>[] } }>(`/video/list/?fields=${fields}`, {
    method: "POST",
    body: JSON.stringify({ max_count: maxCount }),
  });
  return (data.data.videos ?? []).map((v) => ({
    id: v.id as string,
    title: (v.title as string) ?? "",
    coverImageUrl: v.cover_image_url as string,
    shareUrl: v.share_url as string,
    viewCount: (v.view_count as number) ?? 0,
    likeCount: (v.like_count as number) ?? 0,
    commentCount: (v.comment_count as number) ?? 0,
    shareCount: (v.share_count as number) ?? 0,
    createTime: v.create_time as number,
  }));
}

/**
 * Envia um vídeo para a inbox do TikTok como rascunho — o creator tem de
 * abrir a app TikTok e publicar manualmente. Publicação direta (scope
 * video.publish) exige aprovação prévia da app pela TikTok, nunca concedida.
 */
export async function uploadVideoDraft(videoUrl: string): Promise<{ publishId: string }> {
  const data = await api<{ data: { publish_id: string } }>("/post/publish/inbox/video/init/", {
    method: "POST",
    body: JSON.stringify({
      source_info: {
        source: "PULL_FROM_URL",
        video_url: videoUrl,
      },
    }),
  });
  return { publishId: data.data.publish_id };
}

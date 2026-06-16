import { getPages, getPageInfo, getIgMedia, getIgInsights } from "@/lib/meta/graph";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SchedulePostDialog } from "./schedule-post-dialog";
import { Heart, MessageCircle } from "lucide-react";

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "hoje";
  if (d === 1) return "ontem";
  return `há ${d} dias`;
}

export default async function InstagramPage() {
  let error: string | null = null;
  let igId = "";
  let igUsername = "";
  let igFollowers = 0;
  let followerGrowth = 0;
  let totalReach = 0;
  let totalImpressions = 0;
  let media: Awaited<ReturnType<typeof getIgMedia>> = [];

  try {
    const pages = await getPages();
    if (!pages.length) throw new Error("Nenhuma página Facebook encontrada");
    const page = pages[0];
    const pageToken = page.access_token;

    const info = await getPageInfo(page.id, pageToken);
    if (!info.instagram_business_account) {
      throw new Error("Nenhuma conta Instagram Business associada a esta página");
    }
    const ig = info.instagram_business_account;
    igId = ig.id;
    igUsername = ig.username;
    igFollowers = ig.followers_count;

    const [mediaData, insights] = await Promise.all([
      getIgMedia(igId, pageToken, 12),
      getIgInsights(igId, pageToken).catch(() => []),
    ]);
    media = mediaData;

    const followerInsight = insights.find((i) => i.name === "follower_count");
    if (followerInsight && followerInsight.values.length >= 2) {
      const vals = followerInsight.values;
      followerGrowth = vals[vals.length - 1].value - vals[0].value;
    }
    const reachInsight = insights.find((i) => i.name === "reach");
    if (reachInsight) totalReach = reachInsight.values.reduce((s, v) => s + v.value, 0);
    const impInsight = insights.find((i) => i.name === "impressions");
    if (impInsight) totalImpressions = impInsight.values.reduce((s, v) => s + v.value, 0);
  } catch (e) {
    error = (e as Error).message;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Instagram</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const avgLikes = media.length
    ? Math.round(media.reduce((s, m) => s + m.like_count, 0) / media.length)
    : 0;
  const avgComments = media.length
    ? Math.round(media.reduce((s, m) => s + m.comments_count, 0) / media.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Instagram</h1>
          <p className="text-sm text-muted-foreground">@{igUsername} · últimos 30 dias</p>
        </div>
        <SchedulePostDialog igId={igId} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Seguidores", value: igFollowers.toLocaleString("pt-PT") },
          {
            label: "Crescimento (30d)",
            value: followerGrowth >= 0 ? `+${followerGrowth}` : `${followerGrowth}`,
            colored: true,
            positive: followerGrowth >= 0,
          },
          { label: "Alcance (30d)", value: totalReach.toLocaleString("pt-PT") },
          { label: "Impressões (30d)", value: totalImpressions.toLocaleString("pt-PT") },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-semibold ${
                  k.colored ? (k.positive ? "text-emerald-600" : "text-destructive") : ""
                }`}
              >
                {k.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Média de likes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{avgLikes.toLocaleString("pt-PT")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Média de comentários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{avgComments.toLocaleString("pt-PT")}</div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
          Últimas publicações ({media.length})
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {media.map((post) => {
            const thumb = post.thumbnail_url ?? post.media_url;
            return (
              <a
                key={post.id}
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <Card className="overflow-hidden">
                  {thumb && (
                    <div className="relative aspect-square bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumb}
                        alt=""
                        className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                      />
                      {(post.media_type === "VIDEO" || post.media_type === "REELS") && (
                        <span className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                          {post.media_type === "REELS" ? "Reel" : "Vídeo"}
                        </span>
                      )}
                      {post.media_type === "CAROUSEL_ALBUM" && (
                        <span className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                          Álbum
                        </span>
                      )}
                    </div>
                  )}
                  <CardContent className="p-2.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5">
                          <Heart className="size-3" />
                          {post.like_count}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <MessageCircle className="size-3" />
                          {post.comments_count}
                        </span>
                      </div>
                      <span>{timeAgo(post.timestamp)}</span>
                    </div>
                    {post.caption && (
                      <p className="text-xs mt-1.5 line-clamp-2 text-muted-foreground">{post.caption}</p>
                    )}
                  </CardContent>
                </Card>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

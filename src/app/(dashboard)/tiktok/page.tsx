import { getUserInfo, getVideoList } from "@/lib/tiktok/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadDraftDialog } from "./upload-draft-dialog";
import { Heart, MessageCircle, Eye, Share2 } from "lucide-react";

function timeAgo(unixSeconds: number) {
  const d = Math.floor((Date.now() - unixSeconds * 1000) / 86400000);
  if (d === 0) return "hoje";
  if (d === 1) return "ontem";
  return `há ${d} dias`;
}

export default async function TikTokPage() {
  let error: string | null = null;
  let displayName = "";
  let followerCount = 0;
  let likesCount = 0;
  let videoCount = 0;
  let videos: Awaited<ReturnType<typeof getVideoList>> = [];

  try {
    const [info, videoList] = await Promise.all([getUserInfo(), getVideoList(12)]);
    displayName = info.displayName;
    followerCount = info.followerCount;
    likesCount = info.likesCount;
    videoCount = info.videoCount;
    videos = videoList;
  } catch (e) {
    error = (e as Error).message;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">TikTok</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const avgViews = videos.length
    ? Math.round(videos.reduce((s, v) => s + v.viewCount, 0) / videos.length)
    : 0;
  const avgLikes = videos.length
    ? Math.round(videos.reduce((s, v) => s + v.likeCount, 0) / videos.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">TikTok</h1>
          <p className="text-sm text-muted-foreground">@{displayName} · conta de teste (Sandbox)</p>
        </div>
        <UploadDraftDialog />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Seguidores", value: followerCount.toLocaleString("pt-PT") },
          { label: "Gostos totais", value: likesCount.toLocaleString("pt-PT") },
          { label: "Vídeos publicados", value: videoCount.toLocaleString("pt-PT") },
          { label: "Média de visualizações", value: avgViews.toLocaleString("pt-PT") },
        ].map((k) => (
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
          <CardTitle className="text-sm font-medium text-muted-foreground">Média de gostos por vídeo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{avgLikes.toLocaleString("pt-PT")}</div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
          Últimos vídeos ({videos.length})
        </h2>
        {videos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem vídeos para mostrar.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {videos.map((v) => (
              <a key={v.id} href={v.shareUrl} target="_blank" rel="noopener noreferrer" className="group block">
                <Card className="overflow-hidden">
                  {v.coverImageUrl && (
                    <div className="relative aspect-square bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={v.coverImageUrl}
                        alt=""
                        className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                      />
                    </div>
                  )}
                  <CardContent className="p-2.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5">
                          <Eye className="size-3" />
                          {v.viewCount}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Heart className="size-3" />
                          {v.likeCount}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <MessageCircle className="size-3" />
                          {v.commentCount}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Share2 className="size-3" />
                          {v.shareCount}
                        </span>
                      </div>
                      <span>{timeAgo(v.createTime)}</span>
                    </div>
                    {v.title && <p className="text-xs mt-1.5 line-clamp-2 text-muted-foreground">{v.title}</p>}
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

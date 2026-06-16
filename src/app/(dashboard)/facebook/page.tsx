import { PAGE_ID, systemToken, getPageInfo, getPagePosts } from "@/lib/meta/graph";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduleFbPostDialog } from "./schedule-post-dialog";
import { ThumbsUp, MessageCircle, Share2, ExternalLink } from "lucide-react";

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "hoje";
  if (d === 1) return "ontem";
  return `há ${d} dias`;
}

export default async function FacebookPage() {
  let error: string | null = null;
  let pageId = "";
  let pageName = "";
  let fanCount = 0;
  let followersCount = 0;
  let posts: Awaited<ReturnType<typeof getPagePosts>> = [];

  try {
    const tok = systemToken();
    pageId = PAGE_ID;

    const [info, pagePosts] = await Promise.all([
      getPageInfo(PAGE_ID, tok),
      getPagePosts(PAGE_ID, tok, 15),
    ]);

    pageName = info.name;
    fanCount = info.fan_count ?? 0;
    followersCount = info.followers_count ?? 0;
    posts = pagePosts;
  } catch (e) {
    error = (e as Error).message;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Facebook</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalReactions = posts.reduce((s, p) => s + (p.reactions?.summary?.total_count ?? 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.comments?.summary?.total_count ?? 0), 0);
  const totalShares = posts.reduce((s, p) => s + (p.shares?.count ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Facebook</h1>
          <p className="text-sm text-muted-foreground">{pageName}</p>
        </div>
        <ScheduleFbPostDialog pageId={pageId} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Fãs", value: fanCount.toLocaleString("pt-PT") },
          { label: "Seguidores", value: followersCount.toLocaleString("pt-PT") },
          { label: "Reações (últimos posts)", value: totalReactions.toLocaleString("pt-PT") },
          { label: "Partilhas (últimos posts)", value: totalShares.toLocaleString("pt-PT") },
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

      <div>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
          Últimas publicações ({posts.length})
        </h2>
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex gap-4">
                  {post.full_picture && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.full_picture}
                      alt=""
                      className="w-20 h-20 object-cover rounded-md shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-clamp-3 text-foreground">
                      {post.message ?? post.story ?? (
                        <span className="text-muted-foreground italic">Sem texto</span>
                      )}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="size-3" />
                        {post.reactions?.summary?.total_count ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="size-3" />
                        {post.comments?.summary?.total_count ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Share2 className="size-3" />
                        {post.shares?.count ?? 0}
                      </span>
                      <span className="ml-auto">{timeAgo(post.created_time)}</span>
                      <a
                        href={post.permalink_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground"
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

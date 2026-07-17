import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishIgMedia, systemToken } from "@/lib/meta/graph";
import { uploadVideoDraft } from "@/lib/tiktok/client";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Não publicamos vídeo diretamente na Page do Facebook — a API exige Business
// Verification, que esta app não tem. O Instagram já faz crosspost automático
// do Reel para a Page ligada, por isso o conteúdo chega lá de qualquer forma.

export async function GET(req: NextRequest) {
  // Vercel cron authentication
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Post mais antigo ainda não publicado com data <= hoje: se um dia falhar,
  // fica em fila e é retentado na corrida seguinte em vez de ser abandonado.
  const today = new Date();
  const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const post = await prisma.grwmScheduledPost.findFirst({
    where: {
      scheduledDate: { lte: todayDate },
      published: false,
    },
    orderBy: { scheduledDate: "asc" },
  });

  if (!post) {
    return NextResponse.json({ message: "No post scheduled for today" });
  }

  const pageToken = systemToken();
  // Reaproveita IDs de plataformas que já tiveram sucesso numa tentativa
  // anterior, para não publicar em duplicado ao retentar as que falharam.
  const results: Record<string, string | null> = {
    igMediaId: post.igMediaId,
    tiktokPublishId: post.tiktokPublishId,
    fbPostId: post.fbPostId,
  };
  const errors: string[] = [];

  // Instagram — publish Reel immediately (no scheduling = no whitelist needed)
  if (!results.igMediaId) {
    try {
      results.igMediaId = await publishIgMedia(post.igId, pageToken, {
        videoUrl: post.videoUrl,
        caption: post.caption,
      });
    } catch (e) {
      errors.push(`Instagram: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // TikTok — upload draft to creator inbox
  if (!results.tiktokPublishId) {
    try {
      const r = await uploadVideoDraft(post.videoUrl);
      results.tiktokPublishId = r.publishId ?? null;
    } catch (e) {
      errors.push(`TikTok: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const published = results.igMediaId !== null;

  await prisma.grwmScheduledPost.update({
    where: { id: post.id },
    data: {
      published,
      igMediaId: results.igMediaId,
      tiktokPublishId: results.tiktokPublishId,
      fbPostId: results.fbPostId,
      publishedAt: published ? new Date() : undefined,
      errorMsg: errors.length > 0 ? errors.join(" | ") : null,
    },
  });

  return NextResponse.json({
    date: post.scheduledDate,
    published,
    ...results,
    errors: errors.length > 0 ? errors : undefined,
  });
}

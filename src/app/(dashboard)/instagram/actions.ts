"use server";

import { getPages, publishIgMedia } from "@/lib/meta/graph";

export async function scheduleIgPost(params: {
  igId: string;
  mediaUrl: string;
  caption: string;
  scheduledAt: string | null;
  isVideo: boolean;
}) {
  const pages = await getPages();
  if (!pages.length) throw new Error("Nenhuma página Meta encontrada");
  const pageToken = pages[0].access_token;

  const scheduledTime = params.scheduledAt
    ? Math.floor(new Date(params.scheduledAt).getTime() / 1000)
    : undefined;

  await publishIgMedia(params.igId, pageToken, {
    ...(params.isVideo ? { videoUrl: params.mediaUrl } : { imageUrl: params.mediaUrl }),
    caption: params.caption,
    scheduledTime,
  });
}

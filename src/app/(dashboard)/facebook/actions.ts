"use server";

import { getPages, publishFbPost } from "@/lib/meta/graph";

export async function scheduleFbPost(params: {
  pageId: string;
  message: string;
  link?: string;
  scheduledAt: string | null;
}) {
  const pages = await getPages();
  if (!pages.length) throw new Error("Nenhuma página Meta encontrada");
  const page = pages.find((p) => p.id === params.pageId) ?? pages[0];
  const pageToken = page.access_token;

  const scheduledTime = params.scheduledAt
    ? Math.floor(new Date(params.scheduledAt).getTime() / 1000)
    : undefined;

  await publishFbPost(page.id, pageToken, {
    message: params.message,
    link: params.link,
    scheduledTime,
  });
}

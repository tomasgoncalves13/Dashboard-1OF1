"use server";

import { PAGE_ID, systemToken, publishFbPost } from "@/lib/meta/graph";

export async function scheduleFbPost(params: {
  pageId: string;
  message: string;
  link?: string;
  scheduledAt: string | null;
}) {
  const pageToken = systemToken();

  const scheduledTime = params.scheduledAt
    ? Math.floor(new Date(params.scheduledAt).getTime() / 1000)
    : undefined;

  await publishFbPost(PAGE_ID, pageToken, {
    message: params.message,
    link: params.link,
    scheduledTime,
  });
}

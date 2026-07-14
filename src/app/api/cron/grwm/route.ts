import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishIgMedia, PAGE_ID, systemToken } from "@/lib/meta/graph";
import { uploadVideoDraft } from "@/lib/tiktok/client";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function publishFbVideo(videoUrl: string, description: string): Promise<string> {
  const token = systemToken();
  const params = new URLSearchParams({
    file_url: videoUrl,
    description,
    access_token: token,
  });
  const res = await fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const json = await res.json() as { id?: string; error?: { message: string } };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? "Facebook video upload failed");
  return json.id!;
}

export async function GET(req: NextRequest) {
  // Vercel cron authentication
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find today's post (UTC date matches scheduledDate)
  const today = new Date();
  const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const post = await prisma.grwmScheduledPost.findFirst({
    where: {
      scheduledDate: todayDate,
      published: false,
    },
  });

  if (!post) {
    return NextResponse.json({ message: "No post scheduled for today" });
  }

  const pageToken = systemToken();
  const results: Record<string, string | null> = { igMediaId: null, tiktokPublishId: null, fbPostId: null };
  const errors: string[] = [];

  // Instagram — publish Reel immediately (no scheduling = no whitelist needed)
  try {
    const igMediaId = await publishIgMedia(post.igId, pageToken, {
      videoUrl: post.videoUrl,
      caption: post.caption,
    });
    results.igMediaId = igMediaId;
  } catch (e) {
    errors.push(`Instagram: ${e instanceof Error ? e.message : String(e)}`);
  }

  // TikTok — upload draft to creator inbox
  try {
    const r = await uploadVideoDraft(post.videoUrl);
    results.tiktokPublishId = r.publishId ?? null;
  } catch (e) {
    errors.push(`TikTok: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Facebook — publish video post
  try {
    const fbPostId = await publishFbVideo(post.videoUrl, post.caption);
    results.fbPostId = fbPostId;
  } catch (e) {
    errors.push(`Facebook: ${e instanceof Error ? e.message : String(e)}`);
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
      errorMsg: errors.length > 0 ? errors.join(" | ") : undefined,
    },
  });

  return NextResponse.json({
    date: post.scheduledDate,
    published,
    ...results,
    errors: errors.length > 0 ? errors : undefined,
  });
}

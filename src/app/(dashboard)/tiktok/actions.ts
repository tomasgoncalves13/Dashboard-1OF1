"use server";

import { uploadVideoDraft } from "@/lib/tiktok/client";

export async function uploadTikTokDraft(params: { videoUrl: string }) {
  return uploadVideoDraft(params.videoUrl);
}

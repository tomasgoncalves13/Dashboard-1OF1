"use server";

import fs from "fs";
import path from "path";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publishIgMedia, systemToken, getPageInfo, PAGE_ID } from "@/lib/meta/graph";
import { uploadVideoDraft } from "@/lib/tiktok/client";

const GRWM_ROOT =
  "/Users/tomasgoncalves/Documents/1OF1 Fútbol/Anúncios/1OF1 Anúncios/GRWM";

const BUCKET = "grwm-videos";

export interface VideoFile {
  filename: string;
  fullPath: string;
  duration: string;
}

export interface SleeveCombination {
  sleeveColor: string;
  videos: VideoFile[];
}

export interface GripGroup {
  gripColor: string;
  gripFolderName: string;
  sleeves: SleeveCombination[];
}

export async function scanGrwmFolder(): Promise<GripGroup[]> {
  const groups: GripGroup[] = [];

  const gripDirs = fs
    .readdirSync(GRWM_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const gripDir of gripDirs) {
    const gripColor = gripDir.name.replace("Grip ", "");
    const gripPath = path.join(GRWM_ROOT, gripDir.name);
    const sleeves: SleeveCombination[] = [];

    // Videos directly inside the Grip folder (e.g. Grip Branca)
    const directVids = readVideos(gripPath);
    if (directVids.length > 0) {
      sleeves.push({ sleeveColor: gripColor, videos: directVids });
    }

    // Sleeve subfolders (skip Publicados)
    const sleeveDirs = fs
      .readdirSync(gripPath, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "Publicados")
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const sleeveDir of sleeveDirs) {
      const sleeveColor = sleeveDir.name.replace("Sleeve ", "");
      const sleevePath = path.join(gripPath, sleeveDir.name);
      const vids = readVideos(sleevePath);
      if (vids.length > 0) {
        sleeves.push({ sleeveColor, videos: vids });
      }
    }

    if (sleeves.length > 0) {
      groups.push({ gripColor, gripFolderName: gripDir.name, sleeves });
    }
  }

  return groups;
}

function readVideos(dirPath: string): VideoFile[] {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter(
        (f) =>
          f.isFile() &&
          (f.name.toLowerCase().endsWith(".mp4") || f.name.toLowerCase().endsWith(".mov")) &&
          !f.name.startsWith(".")
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((f) => ({
        filename: f.name,
        fullPath: path.join(dirPath, f.name),
        duration: f.name.replace(/\.(mp4|mov)$/i, "").trim(),
      }));
  } catch {
    return [];
  }
}

async function ensureBucket(): Promise<void> {
  const { data } = await supabaseAdmin.storage.listBuckets();
  if (!data?.find((b) => b.name === BUCKET)) {
    await supabaseAdmin.storage.createBucket(BUCKET, { public: true });
  }
}

async function uploadToStorage(filePath: string): Promise<string> {
  await ensureBucket();

  const buffer = fs.readFileSync(filePath);
  const safeName = path.basename(filePath).replace(/\s+/g, "_");
  const key = `${Date.now()}_${safeName}`;
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === ".mov" ? "video/quicktime" : "video/mp4";

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(key, buffer, { contentType, upsert: true });

  if (error) throw new Error(`Upload Supabase: ${error.message}`);
  return supabaseAdmin.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl;
}

export async function scheduleSinglePost(params: {
  videoPath: string;
  caption: string;
  dayIndex: number;
  startDate: string;
  igId: string;
}): Promise<{
  success: boolean;
  igContainerId?: string;
  tiktokPublishId?: string;
  publicUrl?: string;
  error?: string;
}> {
  const { videoPath, caption, dayIndex, startDate, igId } = params;
  const pageToken = systemToken();

  // Schedule at 17:00 UTC = 18:00 Lisbon (summer, UTC+1)
  const scheduledDate = new Date(`${startDate}T17:00:00.000Z`);
  scheduledDate.setUTCDate(scheduledDate.getUTCDate() + dayIndex);
  const scheduledTime = Math.floor(scheduledDate.getTime() / 1000);

  const nowSec = Math.floor(Date.now() / 1000);
  if (scheduledTime < nowSec + 600) {
    return { success: false, error: "Data tem de ser pelo menos 10 min no futuro" };
  }

  try {
    const publicUrl = await uploadToStorage(videoPath);

    const igContainerId = await publishIgMedia(igId, pageToken, {
      videoUrl: publicUrl,
      caption,
      scheduledTime,
    });

    let tiktokPublishId: string | undefined;
    try {
      const r = await uploadVideoDraft(publicUrl);
      tiktokPublishId = r.publishId;
    } catch {
      // TikTok é best-effort
    }

    return { success: true, igContainerId, tiktokPublishId, publicUrl };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getIgId(): Promise<string> {
  const token = systemToken();
  const info = await getPageInfo(PAGE_ID, token);
  if (!info.instagram_business_account?.id) {
    throw new Error("Instagram Business Account não encontrado");
  }
  return info.instagram_business_account.id;
}

export interface ScheduledPost {
  id: string;
  scheduledDate: string;
  videoUrl: string;
  caption: string;
  published: boolean;
  igMediaId: string | null;
  tiktokPublishId: string | null;
  fbPostId: string | null;
  publishedAt: string | null;
  errorMsg: string | null;
}

export async function getScheduledPosts(): Promise<ScheduledPost[]> {
  const { prisma } = await import("@/lib/prisma");
  const { getSessionUser } = await import("@/lib/supabase/server");

  const user = await getSessionUser();
  if (!user) return [];
  const store = await prisma.store.findFirst({ where: { ownerId: user.id } });
  if (!store) return [];

  const posts = await prisma.grwmScheduledPost.findMany({
    where: { storeId: store.id },
    orderBy: { scheduledDate: "asc" },
  });

  return posts.map((p) => ({
    id: p.id,
    scheduledDate: p.scheduledDate.toISOString().slice(0, 10),
    videoUrl: p.videoUrl,
    caption: p.caption,
    published: p.published,
    igMediaId: p.igMediaId,
    tiktokPublishId: p.tiktokPublishId,
    fbPostId: p.fbPostId,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    errorMsg: p.errorMsg,
  }));
}

#!/usr/bin/env node
// Seeds GrwmScheduledPost records from grwm-schedule.json into the database.
// Run once: node scripts/seed-grwm.mjs
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schedule = JSON.parse(readFileSync(join(__dirname, "grwm-schedule.json"), "utf-8"));

const prisma = new PrismaClient();

async function main() {
  // Find the store (single-tenant)
  const store = await prisma.store.findFirst();
  if (!store) throw new Error("No store found — run db:seed first");

  let created = 0;
  let skipped = 0;

  for (const post of schedule) {
    const scheduledDate = new Date(`${post.date}T00:00:00.000Z`);

    const existing = await prisma.grwmScheduledPost.findUnique({
      where: { storeId_scheduledDate: { storeId: store.id, scheduledDate } },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.grwmScheduledPost.create({
      data: {
        storeId: store.id,
        scheduledDate,
        videoUrl: post.publicUrl,
        caption: post.caption,
        igId: post.igId,
      },
    });
    created++;
    console.log(`✓ Day ${post.day} — ${post.date} — ${post.caption.slice(0, 50)}…`);
  }

  console.log(`\nDone: ${created} created, ${skipped} already existed.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

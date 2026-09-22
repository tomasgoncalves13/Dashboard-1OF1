#!/usr/bin/env node
// Repeats the GRWM cycle: reuses the already-published posts (same
// videoUrl + caption, same order — no consecutive-color repeats) and
// schedules them again 1/day starting tomorrow.
// Run: node scripts/reschedule-grwm-cycle.mjs
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env") });

const prisma = new PrismaClient();

async function main() {
  const store = await prisma.store.findFirst();
  if (!store) throw new Error("Nenhuma store encontrada");

  const published = await prisma.grwmScheduledPost.findMany({
    where: { storeId: store.id, published: true },
    orderBy: { scheduledDate: "asc" },
  });

  if (published.length === 0) {
    console.log("Nenhum post publicado encontrado para repetir o ciclo.");
    return;
  }

  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 1); // amanhã
  start.setUTCHours(0, 0, 0, 0);

  console.log(`A repetir ciclo de ${published.length} posts a partir de ${start.toISOString().slice(0,10)}...\n`);

  let ok = 0;
  for (let i = 0; i < published.length; i++) {
    const p = published[i];
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + i);
    const dateStr = date.toISOString().slice(0, 10);

    try {
      await prisma.grwmScheduledPost.create({
        data: {
          storeId: store.id,
          scheduledDate: date,
          videoUrl: p.videoUrl,
          caption: p.caption,
          igId: p.igId,
        },
      });
      console.log(`  ${dateStr} | ${p.caption.slice(0, 45)} ✓`);
      ok++;
    } catch (e) {
      console.log(`  ${dateStr} | ✗ ${e.message}`);
    }
  }

  console.log(`\nConcluído: ${ok}/${published.length} posts reagendados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

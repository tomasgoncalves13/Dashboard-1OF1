#!/usr/bin/env node
// Fase 2 do GRWM: apaga os posts antigos (todos já publicados) e agenda os
// 16 vídeos preparados em scripts/grwm-pending-batch2.json.
// Run: node scripts/schedule-grwm-batch2.mjs
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env") });

const BUCKET = "grwm-videos";
const IG_ID = "17841471087722696";
const START_DATE = "2026-08-10";

const pending = JSON.parse(
  readFileSync(join(__dirname, "grwm-pending-batch2.json"), "utf-8")
);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Same interleave rule as reorder-grwm-pending.mjs: never repeat the grip
// color on consecutive days, greedily draining the largest queue first.
function interleave(items) {
  const byColor = new Map();
  for (const it of items) {
    const list = byColor.get(it.grip) ?? [];
    list.push(it);
    byColor.set(it.grip, list);
  }
  const groups = shuffle([...byColor.entries()]).map(([color, queue]) => ({
    color,
    queue: shuffle(queue),
  }));

  const result = [];
  let lastColor = null;
  while (groups.some((g) => g.queue.length > 0)) {
    groups.sort((a, b) => b.queue.length - a.queue.length);
    const pick =
      groups.find((g) => g.queue.length > 0 && g.color !== lastColor) ??
      groups.find((g) => g.queue.length > 0);
    if (!pick) break;
    result.push(pick.queue.shift());
    lastColor = pick.color;
  }
  return result;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const prisma = new PrismaClient();

async function uploadFile(item) {
  const buf = readFileSync(item.uploadPath);
  const safeName = item.uploadPath.split("/").pop();
  const key = `v4_${safeName}`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(key, buf, { contentType: "video/mp4", upsert: true });
  if (error) throw new Error(`Supabase upload: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl;
}

async function main() {
  const store = await prisma.store.findFirst();
  if (!store) throw new Error("Nenhuma store encontrada");

  // 1. Apagar posts antigos (fase 1, todos já publicados) + ficheiros no storage
  const { data: oldFiles, error: listErr } = await supabase.storage
    .from(BUCKET)
    .list("", { limit: 500 });
  if (listErr) throw listErr;
  if (oldFiles?.length) {
    const { error: rmErr } = await supabase.storage
      .from(BUCKET)
      .remove(oldFiles.map((f) => f.name));
    if (rmErr) throw rmErr;
    console.log(`Removidos ${oldFiles.length} ficheiros antigos do storage.`);
  }

  const deleted = await prisma.grwmScheduledPost.deleteMany({ where: { storeId: store.id } });
  console.log(`Removidos ${deleted.count} posts antigos da base de dados.\n`);

  // 2. Ordenar os 16 vídeos da fase 2 sem repetir grip em dias consecutivos
  const order = interleave(pending);

  // 3. Upload + criar novos registos
  console.log(`A carregar ${order.length} vídeos da fase 2 e a agendar a partir de ${START_DATE}…\n`);
  let ok = 0;
  for (let day = 0; day < order.length; day++) {
    const item = order[day];
    const date = new Date(`${START_DATE}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + day);
    const dateStr = date.toISOString().slice(0, 10);

    process.stdout.write(
      `Dia ${String(day + 1).padStart(2)} | ${dateStr} | Grip ${item.grip.padEnd(9)} + Sleeve ${item.sleeve.padEnd(8)} ${item.duration}seg | `
    );

    try {
      const url = await uploadFile(item);
      await prisma.grwmScheduledPost.create({
        data: {
          storeId: store.id,
          scheduledDate: date,
          videoUrl: url,
          caption: item.caption,
          igId: IG_ID,
        },
      });
      console.log("✓");
      ok++;
    } catch (e) {
      console.log(`✗ ${e.message}`);
    }
  }

  console.log(`\nConcluído: ${ok}/${order.length} posts agendados (fase 2, 10–25 ago).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

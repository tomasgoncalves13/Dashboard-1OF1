#!/usr/bin/env node
// Rebuilds the GRWM schedule for 30 days.
// Uploads each unique video once, reuses URLs for repeated days.
// Run: node scripts/rebuild-grwm-30.mjs
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { readFileSync, statSync } from "fs";
import { join } from "path";
import { config } from "dotenv";

config({ path: join(process.cwd(), ".env") });

const GRWM_ROOT = "/Users/tomasgoncalves/Documents/1OF1 Fútbol/Anúncios/1OF1 Anúncios/GRWM";
const BUCKET = "grwm-videos";
const START_DATE = "2026-07-14";
const MAX_BYTES = 49 * 1024 * 1024;

const EMOJIS = { Azul: "💙", Verde: "💚", Amarela: "⚡️", Vermelha: "🔴", Branca: "🤍", Preta: "🖤" };

function caption(grip, sleeve) {
  const emoji = EMOJIS[grip] ?? "⚽";
  return `Meia Antiderrapante ${grip} + Meia Cortada ${sleeve} ${emoji}#1OF1Futbol #gripsocks #shinpads`;
}

// 30-day rotation: Azul → Verde → Amarela
// Each grip cycles through its available videos (longest first) before repeating.
// Pool per grip (sorted: longer duration first, then by sleeve):
const AZUL_POOL = [
  { sleeve: "Branca", dur: "15 seg", file: "Grip Azul/Sleeve Branca/15 seg.mp4" },
  { sleeve: "Preta",  dur: "15 seg", file: "Grip Azul/Sleeve Preta/15 seg.mp4"  },
];
const VERDE_POOL = [
  { sleeve: "Preta",  dur: "15 seg", file: "Grip Verde/Sleeve Preta/15 seg.mp4" },
];
const AMARELA_POOL = [
  { sleeve: "Branca", dur: "20 seg", file: "Grip Amarela/Sleeve Branca/20 seg.mp4" },
  { sleeve: "Amarela",dur: "15 seg", file: "Grip Amarela/Sleeve Amarela/15 seg.mp4" },
  { sleeve: "Branca", dur: "15 seg", file: "Grip Amarela/Sleeve Branca/15 seg.mp4" },
  { sleeve: "Preta",  dur: "15 seg", file: "Grip Amarela/Sleeve Preta/15 seg .mp4" },
];

const POOLS = { Azul: AZUL_POOL, Verde: VERDE_POOL, Amarela: AMARELA_POOL };
const GRIP_ORDER = ["Azul", "Verde", "Amarela"];

// Build 30-day plan
const PLAN = [];
const indices = { Azul: 0, Verde: 0, Amarela: 0 };

for (let day = 0; day < 30; day++) {
  const grip = GRIP_ORDER[day % 3];
  const pool = POOLS[grip];
  const entry = pool[indices[grip] % pool.length];
  indices[grip]++;
  const date = new Date(`${START_DATE}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + day);
  PLAN.push({ day: day + 1, date: date.toISOString().slice(0, 10), grip, ...entry });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const prisma = new PrismaClient();

async function ensureBucket() {
  const { data } = await supabase.storage.listBuckets();
  if (!data?.find((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true });
  }
}

async function uploadFile(relPath) {
  const fullPath = join(GRWM_ROOT, relPath);
  const size = statSync(fullPath).size;
  if (size > MAX_BYTES) throw new Error(`${relPath} é ${Math.round(size/1024/1024)}MB > 49MB`);

  const buf = readFileSync(fullPath);
  const safeName = relPath.replace(/[/ ]+/g, "_").replace(/^_/, "");
  const ext = relPath.endsWith(".mov") ? "mov" : "mp4";
  const key = `v2_${safeName}`;
  const contentType = ext === "mov" ? "video/quicktime" : "video/mp4";

  const { data, error } = await supabase.storage.from(BUCKET).upload(key, buf, { contentType, upsert: true });
  if (error) throw new Error(`Supabase upload: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl;
}

async function main() {
  const store = await prisma.store.findFirst();
  if (!store) throw new Error("Nenhuma store encontrada");

  await ensureBucket();

  // Upload unique files once
  console.log("A carregar vídeos únicos para Supabase…\n");
  const urlCache = {};
  const uniqueFiles = [...new Set(PLAN.map((p) => p.file))];

  for (const file of uniqueFiles) {
    process.stdout.write(`  Uploading ${file}… `);
    try {
      const url = await uploadFile(file);
      urlCache[file] = url;
      console.log("✓");
    } catch (e) {
      console.log(`✗ ${e.message}`);
      urlCache[file] = null;
    }
  }

  // Delete old schedule
  const deleted = await prisma.grwmScheduledPost.deleteMany({ where: { storeId: store.id } });
  console.log(`\nRemovidos ${deleted.count} posts anteriores.`);

  // Get IG ID from env or first post's igId
  const igId = "17841471087722696";

  // Insert 30 new records
  console.log("\nA criar agenda de 30 dias…\n");
  let ok = 0;
  let skip = 0;
  for (const p of PLAN) {
    const url = urlCache[p.file];
    if (!url) { console.log(`  Dia ${p.day} (${p.date}): ✗ sem URL`); skip++; continue; }

    await prisma.grwmScheduledPost.create({
      data: {
        storeId: store.id,
        scheduledDate: new Date(`${p.date}T00:00:00.000Z`),
        videoUrl: url,
        caption: caption(p.grip, p.sleeve),
        igId,
      },
    });
    console.log(`  Dia ${p.day} (${p.date}) — Grip ${p.grip} + Sleeve ${p.sleeve} ${p.dur} ✓`);
    ok++;
  }

  console.log(`\nConcluído: ${ok} criados, ${skip} ignorados.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

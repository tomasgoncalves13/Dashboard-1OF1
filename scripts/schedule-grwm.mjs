#!/usr/bin/env node
/**
 * GRWM Scheduler — agenda 14 dias de posts no Instagram e TikTok.
 * Corre com: node scripts/schedule-grwm.mjs
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env") });

// ─── Config ──────────────────────────────────────────────────────────────────

const GRWM_ROOT =
  "/Users/tomasgoncalves/Documents/1OF1 Fútbol/Anúncios/1OF1 Anúncios/GRWM";

const BUCKET = "grwm-videos";

// Dia 1 = amanhã às 18:00 Lisboa (17:00 UTC em verão)
const START_DATE = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
})();

const TOTAL_DAYS = 14;

const GRIP_EMOJIS = {
  Amarela: "⚡️",
  Azul: "💙",
  Verde: "💚",
  Vermelha: "🔴",
  Branca: "🤍",
  Preta: "🖤",
};

// ─── Supabase ─────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function ensureBucket() {
  const { data } = await supabase.storage.listBuckets();
  if (!data?.find((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true });
    console.log(`  ✓ Bucket '${BUCKET}' criado`);
  }
}

async function uploadVideo(filePath) {
  const buffer = fs.readFileSync(filePath);
  const safeName = path.basename(filePath).replace(/\s+/g, "_");
  const key = `${Date.now()}_${safeName}`;
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === ".mov" ? "video/quicktime" : "video/mp4";

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(key, buffer, { contentType, upsert: true });

  if (error) throw new Error(`Upload falhou: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl;
}

// ─── Instagram ───────────────────────────────────────────────────────────────

const META_BASE = "https://graph.facebook.com/v21.0";
const PAGE_ID = "501834049687066";

async function getPageToken() {
  const sysToken = process.env.META_PAGE_ACCESS_TOKEN;
  const res = await fetch(
    `${META_BASE}/${PAGE_ID}?fields=access_token,instagram_business_account{id}&access_token=${sysToken}`
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return {
    pageToken: data.access_token || sysToken,
    igId: data.instagram_business_account?.id,
  };
}

async function getIgId() {
  const { igId } = await getPageToken();
  return igId;
}

async function scheduleIgReel(igId, videoUrl, caption, scheduledTime) {
  const { pageToken: token } = await getPageToken();
  const res = await fetch(`${META_BASE}/${igId}/media?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      video_url: videoUrl,
      media_type: "REELS",
      caption,
      published: "false",
      scheduled_publish_time: scheduledTime.toString(),
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.id;
}

// ─── TikTok ──────────────────────────────────────────────────────────────────

const TT_BASE = "https://open.tiktokapis.com/v2";
let cachedToken = null;

async function getTikTokToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000)
    return cachedToken.token;

  const res = await fetch(`${TT_BASE}/oauth/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: process.env.TIKTOK_REFRESH_TOKEN,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description ?? data.error);
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

async function uploadTikTokDraft(videoUrl) {
  const token = await getTikTokToken();
  const res = await fetch(`${TT_BASE}/post/publish/inbox/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_info: { source: "PULL_FROM_URL", video_url: videoUrl },
    }),
  });
  const data = await res.json();
  if (data.error?.code && data.error.code !== "ok")
    throw new Error(data.error.message ?? data.error.code);
  return data.data?.publish_id;
}

// ─── Scan GRWM folder ────────────────────────────────────────────────────────

function readVideos(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter(
        (f) =>
          f.isFile() &&
          /\.(mp4|mov)$/i.test(f.name) &&
          !f.name.startsWith(".")
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((f) => ({
        filename: f.name,
        fullPath: path.join(dir, f.name),
        duration: f.name.replace(/\.(mp4|mov)$/i, "").trim(),
      }));
  } catch {
    return [];
  }
}

function scanGrwm() {
  const combos = [];
  const gripDirs = fs
    .readdirSync(GRWM_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const gripDir of gripDirs) {
    const gripColor = gripDir.name.replace("Grip ", "");
    const gripPath = path.join(GRWM_ROOT, gripDir.name);

    // Vídeos directos (ex: Grip Branca)
    const direct = readVideos(gripPath);
    if (direct.length > 0)
      combos.push({ gripColor, sleeveColor: gripColor, videos: direct });

    // Subpastas Sleeve (excluir Publicados)
    const sleeveDirs = fs
      .readdirSync(gripPath, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "Publicados")
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const sleeveDir of sleeveDirs) {
      const sleeveColor = sleeveDir.name.replace("Sleeve ", "");
      const videos = readVideos(path.join(gripPath, sleeveDir.name));
      if (videos.length > 0)
        combos.push({ gripColor, sleeveColor, videos });
    }
  }
  return combos;
}

function makeCaption(gripColor, sleeveColor) {
  const emoji = GRIP_EMOJIS[gripColor] ?? "⚽";
  return `Meia Antiderrapante ${gripColor} + Meia Cortada ${sleeveColor} ${emoji}#1OF1Futbol #gripsocks #shinpads`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🎬 GRWM Scheduler — 1OF1 Fútbol");
  console.log(`📅 Início: ${START_DATE} | ${TOTAL_DAYS} dias às 18:00 Lisboa\n`);

  // Scan
  const combos = scanGrwm();
  if (combos.length === 0) {
    console.error("❌ Nenhum vídeo encontrado em", GRWM_ROOT);
    process.exit(1);
  }
  console.log(`📁 ${combos.length} combinações encontradas:`);
  combos.forEach((c) =>
    console.log(`   • Grip ${c.gripColor} / Sleeve ${c.sleeveColor} — ${c.videos.length} vídeo(s)`)
  );
  console.log();

  await ensureBucket();
  const igId = await getIgId();
  console.log(`📸 Instagram ID: ${igId}\n`);

  // Fase 1: Upload de todos os vídeos e guardar o schedule
  const schedule = [];
  console.log("⬆️  A fazer upload de todos os vídeos para Supabase Storage...\n");

  for (let day = 0; day < TOTAL_DAYS; day++) {
    const dt = new Date(`${START_DATE}T17:00:00.000Z`);
    dt.setUTCDate(dt.getUTCDate() + day);
    const dateStr = dt.toISOString().slice(0, 10);

    // Tenta combos até encontrar um vídeo < 49MB (rotação + fallback)
    let combo, video, sizeMb;
    let found = false;
    for (let offset = 0; offset < combos.length; offset++) {
      combo = combos[(day + offset) % combos.length];
      const smallestVid = [...combo.videos].sort(
        (a, b) => fs.statSync(a.fullPath).size - fs.statSync(b.fullPath).size
      )[0];
      const mb = fs.statSync(smallestVid.fullPath).size / 1024 / 1024;
      if (mb < 49) { video = smallestVid; sizeMb = mb.toFixed(1); found = true; break; }
    }

    const caption = makeCaption(combo.gripColor, combo.sleeveColor);
    process.stdout.write(
      `Dia ${String(day + 1).padStart(2)} | ${dateStr} | Grip ${combo.gripColor.padEnd(8)} | ${(video?.duration ?? "—").padEnd(10)} | ${sizeMb ?? "—"}MB | `
    );

    if (!found) {
      process.stdout.write("⚠️  todos os vídeos > 49MB\n");
      continue;
    }

    try {
      const publicUrl = await uploadVideo(video.fullPath);
      process.stdout.write(`✓ ${publicUrl.slice(-30)}\n`);
      schedule.push({ day: day + 1, date: dateStr, igId, publicUrl, caption, published: false });
    } catch (e) {
      process.stdout.write(`❌ ${e.message}\n`);
    }
  }

  // Guardar schedule em JSON
  const schedulePath = path.join(__dirname, "grwm-schedule.json");
  fs.writeFileSync(schedulePath, JSON.stringify(schedule, null, 2));
  console.log(`\n✅ Schedule guardado em scripts/grwm-schedule.json (${schedule.length} posts)\n`);

  // Fase 2: Setup do publicador diário
  console.log("⏰ A configurar publicação automática às 18:00 diária...");
  await setupDailyPublisher();
  console.log("✅ Pronto! Os posts serão publicados automaticamente às 18:00 Lisboa.\n");
  console.log("📱 TikTok: corre 'node scripts/upload-tiktok-drafts.mjs' para enviar os drafts.\n");
}

async function setupDailyPublisher() {
  const scriptDir = path.join(__dirname);
  const publishScript = path.join(scriptDir, "publish-grwm-today.mjs");
  const nodePath = process.execPath;

  // Criar o script que publica o post do dia
  const publisherCode = `#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '../.env') });

const schedulePath = path.join(__dirname, 'grwm-schedule.json');
const schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
const today = new Date().toISOString().slice(0, 10);

const post = schedule.find(p => p.date === today && !p.published);
if (!post) {
  console.log(today, '— sem post GRWM para hoje ou já publicado.');
  process.exit(0);
}

const BASE = 'https://graph.facebook.com/v21.0';
const token = process.env.META_PAGE_ACCESS_TOKEN;

async function getPageToken() {
  const PAGE_ID = '501834049687066';
  const res = await fetch(\`\${BASE}/\${PAGE_ID}?fields=access_token&access_token=\${token}\`).then(r=>r.json());
  return res.access_token || token;
}

async function publishReel(igId, videoUrl, caption) {
  const pt = await getPageToken();
  // Criar container
  const container = await fetch(\`\${BASE}/\${igId}/media?access_token=\${pt}\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_url: videoUrl, media_type: 'REELS', caption }),
  }).then(r=>r.json());
  if (container.error) throw new Error(container.error.message);

  // Aguardar processamento (máx 5 min)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 10000));
    const status = await fetch(\`\${BASE}/\${container.id}?fields=status_code&access_token=\${pt}\`).then(r=>r.json());
    if (status.status_code === 'FINISHED') break;
    if (status.status_code === 'ERROR') throw new Error('Erro no processamento do vídeo');
    process.stdout.write('.');
  }

  // Publicar
  const pub = await fetch(\`\${BASE}/\${igId}/media_publish?access_token=\${pt}\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id }),
  }).then(r=>r.json());
  if (pub.error) throw new Error(pub.error.message);
  return pub.id;
}

(async () => {
  console.log(\`📸 A publicar GRWM \${today}...\`);
  const mediaId = await publishReel(post.igId, post.publicUrl, post.caption);
  console.log('✅ Publicado! ID:', mediaId);

  // Marcar como publicado
  post.published = true;
  fs.writeFileSync(schedulePath, JSON.stringify(schedule, null, 2));
})().catch(e => { console.error('❌', e.message); process.exit(1); });
`;

  fs.writeFileSync(publishScript, publisherCode);
  fs.chmodSync(publishScript, "755");

  // macOS launchd agent
  const plistLabel = "com.1of1futbol.grwm-publisher";
  const plistPath = path.join(
    process.env.HOME,
    "Library/LaunchAgents",
    `${plistLabel}.plist`
  );

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${plistLabel}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${publishScript}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${path.join(__dirname, "..")}</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>18</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/tmp/grwm-publisher.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/grwm-publisher.log</string>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>`;

  fs.writeFileSync(plistPath, plist);

  // Load the agent
  try {
    const { execSync } = await import("child_process");
    execSync(`launchctl unload "${plistPath}" 2>/dev/null; launchctl load "${plistPath}"`);
    console.log(`  ✓ launchd agent carregado: ${plistLabel}`);
  } catch (e) {
    console.log(`  ⚠️  launchd: ${e.message}`);
  }
}

main().catch((e) => {
  console.error("Erro fatal:", e.message);
  process.exit(1);
});

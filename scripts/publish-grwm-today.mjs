#!/usr/bin/env node
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
  const res = await fetch(`${BASE}/${PAGE_ID}?fields=access_token&access_token=${token}`).then(r=>r.json());
  return res.access_token || token;
}

async function publishReel(igId, videoUrl, caption) {
  const pt = await getPageToken();
  // Criar container
  const container = await fetch(`${BASE}/${igId}/media?access_token=${pt}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_url: videoUrl, media_type: 'REELS', caption }),
  }).then(r=>r.json());
  if (container.error) throw new Error(container.error.message);

  // Aguardar processamento (máx 5 min)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 10000));
    const status = await fetch(`${BASE}/${container.id}?fields=status_code&access_token=${pt}`).then(r=>r.json());
    if (status.status_code === 'FINISHED') break;
    if (status.status_code === 'ERROR') throw new Error('Erro no processamento do vídeo');
    process.stdout.write('.');
  }

  // Publicar
  const pub = await fetch(`${BASE}/${igId}/media_publish?access_token=${pt}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id }),
  }).then(r=>r.json());
  if (pub.error) throw new Error(pub.error.message);
  return pub.id;
}

(async () => {
  console.log(`📸 A publicar GRWM ${today}...`);
  const mediaId = await publishReel(post.igId, post.publicUrl, post.caption);
  console.log('✅ Publicado! ID:', mediaId);

  // Marcar como publicado
  post.published = true;
  fs.writeFileSync(schedulePath, JSON.stringify(schedule, null, 2));
})().catch(e => { console.error('❌', e.message); process.exit(1); });

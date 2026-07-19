#!/usr/bin/env node
// Reorders pending (unpublished) GrwmScheduledPost rows so consecutive
// scheduledDates don't repeat the same grip (anti-slip sock) color.
// Keeps ids and scheduledDate untouched — only swaps videoUrl + caption
// between existing rows. Already-published rows are never touched or deleted.
//
// Preview: node scripts/reorder-grwm-pending.mjs --dry-run
// Apply:   node scripts/reorder-grwm-pending.mjs
//
// Optionally boost how many times a color repeats (reusing the exact same
// video/caption already in the DB for that color), trimming the excess from
// whichever color currently has the most so the total stays equal to the
// number of pending rows:
//   node scripts/reorder-grwm-pending.mjs --boost Vermelha=3 --dry-run
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env") });

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

function parseBoosts(argv) {
  const boosts = {};
  const idx = argv.indexOf("--boost");
  if (idx === -1) return boosts;
  for (let i = idx + 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) break;
    const [color, countStr] = arg.split("=");
    const count = parseInt(countStr, 10);
    if (color && Number.isFinite(count)) boosts[color] = count;
  }
  return boosts;
}

const BOOSTS = parseBoosts(process.argv);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function gripColorOf(caption) {
  const m = caption.match(/Meia Antiderrapante (\S+)/);
  return m ? m[1] : "?";
}

// Groups items by grip color, shuffles color order + each color's queue,
// then greedily picks from whichever non-empty color has the most items
// left (breaking ties via the earlier shuffle) as long as it isn't the
// color just used — same rule as the "Reorganize String" problem.
function interleave(items, seedLastColor) {
  const byColor = new Map();
  for (const it of items) {
    const list = byColor.get(it.color) ?? [];
    list.push(it);
    byColor.set(it.color, list);
  }

  const groups = shuffle([...byColor.entries()]).map(([color, queue]) => ({
    color,
    queue: shuffle(queue),
  }));

  const result = [];
  let lastColor = seedLastColor ?? null;

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

// Raises the count of boosted colors up to their target by cloning an
// existing item of that color (same videoUrl + caption), then trims the
// same number of items from whichever color currently has the most, so the
// pool size stays equal to the number of pending rows.
function applyBoosts(items, boosts) {
  const byColor = new Map();
  for (const it of items) {
    const list = byColor.get(it.color) ?? [];
    list.push(it);
    byColor.set(it.color, list);
  }

  for (const [color, target] of Object.entries(boosts)) {
    const list = byColor.get(color);
    if (!list || list.length === 0) {
      console.warn(`Aviso: cor "${color}" não encontrada nos posts pendentes — a ignorar boost.`);
      continue;
    }
    while (list.length < target) list.push({ ...list[0] });
  }

  let total = [...byColor.values()].flat().length;
  while (total > items.length) {
    const candidates = [...byColor.entries()].filter(
      ([color, list]) => list.length > 1 && !(boosts[color] && list.length <= boosts[color])
    );
    candidates.sort((a, b) => b[1].length - a[1].length);
    if (candidates.length === 0) break;
    candidates[0][1].pop();
    total--;
  }

  return [...byColor.values()].flat();
}

async function main() {
  const store = await prisma.store.findFirst();
  if (!store) throw new Error("Nenhuma store encontrada");

  const posts = await prisma.grwmScheduledPost.findMany({
    where: { storeId: store.id },
    orderBy: { scheduledDate: "asc" },
  });

  if (posts.length === 0) {
    console.log("Nenhum post GRWM encontrado.");
    return;
  }

  const pending = posts.filter((p) => !p.published);
  if (pending.length === 0) {
    console.log("Não há posts pendentes para reordenar (todos já publicados).");
    return;
  }

  // Cor do post imediatamente anterior ao primeiro pendente (normalmente o
  // último já publicado), para o primeiro pendente também não repetir essa cor.
  const firstPendingIdx = posts.findIndex((p) => !p.published);
  const priorPost = posts[firstPendingIdx - 1];
  const seedLastColor = priorPost ? gripColorOf(priorPost.caption) : null;

  const rawItems = pending.map((p) => ({
    color: gripColorOf(p.caption),
    videoUrl: p.videoUrl,
    caption: p.caption,
  }));

  const items =
    Object.keys(BOOSTS).length > 0 ? applyBoosts(rawItems, BOOSTS) : rawItems;

  const newOrder = interleave(items, seedLastColor);

  console.log(`${pending.length} posts pendentes — nova ordem:\n`);
  pending.forEach((p, i) => {
    const date = p.scheduledDate.toISOString().slice(0, 10);
    const oldColor = gripColorOf(p.caption);
    const newColor = newOrder[i].color;
    console.log(`  ${date}  ${oldColor.padEnd(10)} -> ${newColor.padEnd(10)}`);
  });

  if (DRY_RUN) {
    console.log("\n(dry-run — nada foi alterado. Corre sem --dry-run para aplicar.)");
    return;
  }

  for (let i = 0; i < pending.length; i++) {
    await prisma.grwmScheduledPost.update({
      where: { id: pending[i].id },
      data: {
        videoUrl: newOrder[i].videoUrl,
        caption: newOrder[i].caption,
      },
    });
  }

  console.log(`\n✓ ${pending.length} posts atualizados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

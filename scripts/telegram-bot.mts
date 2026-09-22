#!/usr/bin/env node
/**
 * Bot de Telegram para registar vendas físicas por texto.
 *
 * Corre com: npx tsx scripts/telegram-bot.mts
 * Faz long-polling ao Telegram (sem precisar de URL pública/webhook) e usa o
 * Claude Code CLI local (subscrição, sem custo extra de API) para interpretar
 * a mensagem e propor a venda. Só regista na base de dados depois de confirmares
 * com "sim" no Telegram.
 */

import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { execFileSync } from "child_process";
import { PrismaClient, Prisma, type StockMovementType } from "@prisma/client";

// Duplicado de src/lib/inventory/consume.ts — importar esse .ts diretamente
// falha porque o tsx trata ficheiros .ts soltos (sem .mts) como CommonJS aqui,
// o que quebra os exports nomeados.
async function consumeStock(
  tx: Prisma.TransactionClient,
  args: { storeId: string; variantId: string; saleQty: number; type: StockMovementType; reference?: string },
): Promise<boolean> {
  const components = await tx.variantComponent.findMany({ where: { variantId: args.variantId } });
  if (components.length === 0) return false;

  for (const c of components) {
    const qty = c.quantity * args.saleQty;
    await tx.inventoryItem.update({ where: { id: c.inventoryItemId }, data: { stockOnHand: { decrement: qty } } });
    await tx.stockMovement.create({
      data: {
        storeId: args.storeId,
        inventoryItemId: c.inventoryItemId,
        variantId: args.variantId,
        type: args.type,
        quantity: -qty,
        reference: args.reference,
      },
    });
  }
  return true;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env") });

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TOKEN || !CHAT_ID) {
  throw new Error("Falta TELEGRAM_TOKEN ou TELEGRAM_CHAT_ID no .env");
}

const API = `https://api.telegram.org/bot${TOKEN}`;
const prisma = new PrismaClient();

type Draft = {
  clubId: string | null;
  clubName: string | null;
  items: { variantId: string; title: string; quantity: number; unitPrice: number; unitCost: number }[];
  notes: string | null;
  createdAt: number;
};

const drafts = new Map<string, Draft>();
const DRAFT_TTL_MS = 10 * 60 * 1000;

async function sendMessage(text: string) {
  await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text }),
  });
}

async function getCatalogContext() {
  const store = await prisma.store.findFirst();
  if (!store) throw new Error("Nenhuma store encontrada");

  const clubs = await prisma.club.findMany({
    where: { storeId: store.id, isActive: true },
    include: { productPrices: true },
  });

  const variants = await prisma.productVariant.findMany({
    where: { storeId: store.id },
    include: { product: { select: { title: true } } },
  });

  return { store, clubs, variants };
}

type ParsedSale = {
  clubId: string | null;
  items: { variantId: string; quantity: number; unitPrice: number | null }[];
  notes: string | null;
  warnings: string[];
};

function parseSaleWithClaude(text: string, catalog: Awaited<ReturnType<typeof getCatalogContext>>): ParsedSale {
  const clubList = catalog.clubs
    .map((c) => `- id="${c.id}" nome="${c.name}"`)
    .join("\n");

  const variantList = catalog.variants
    .map((v) => `- id="${v.id}" produto="${v.product.title}" variante="${v.title}" precoLoja=${v.price}`)
    .join("\n");

  const prompt = `Um dono de loja mandou-me esta mensagem no Telegram a descrever uma venda física feita a um clube ou pessoa:

"""
${text}
"""

Clubes existentes (usa o id exato se corresponder a algum, senão null):
${clubList}

Variantes de produto existentes (tens de escolher o id exato de uma destas para cada item; se não conseguires identificar com confiança, não incluas o item e explica em "warnings"):
${variantList}

Extrai a informação da venda. Se o texto mencionar um preço por unidade, usa esse valor em "unitPrice". Se não mencionar preço nenhum, deixa "unitPrice" como null.`;

  const schema = JSON.stringify({
    type: "object",
    properties: {
      clubId: { type: ["string", "null"] },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            variantId: { type: "string" },
            quantity: { type: "number" },
            unitPrice: { type: ["number", "null"] },
          },
          required: ["variantId", "quantity", "unitPrice"],
        },
      },
      notes: { type: ["string", "null"] },
      warnings: { type: "array", items: { type: "string" } },
    },
    required: ["clubId", "items", "notes", "warnings"],
  });

  const raw = execFileSync(
    "claude",
    ["-p", prompt, "--output-format", "json", "--json-schema", schema, "--model", "sonnet"],
    { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
  );

  const result = JSON.parse(raw);
  if (result.is_error || !result.structured_output) {
    throw new Error("Claude não conseguiu interpretar a mensagem: " + (result.result ?? raw));
  }
  return result.structured_output as ParsedSale;
}

async function handleNewSaleText(chatId: string, text: string) {
  await sendMessage("A interpretar...");

  const catalog = await getCatalogContext();
  let parsed: ParsedSale;
  try {
    parsed = parseSaleWithClaude(text, catalog);
  } catch (err) {
    await sendMessage("Não consegui interpretar a mensagem: " + (err instanceof Error ? err.message : String(err)));
    return;
  }

  if (parsed.items.length === 0) {
    const warn = parsed.warnings.length ? "\n" + parsed.warnings.join("\n") : "";
    await sendMessage("Não consegui identificar nenhum produto do catálogo nessa mensagem." + warn);
    return;
  }

  const club = parsed.clubId ? catalog.clubs.find((c) => c.id === parsed.clubId) ?? null : null;

  const items = parsed.items.map((item) => {
    const variant = catalog.variants.find((v) => v.id === item.variantId);
    if (!variant) throw new Error("Variante inválida devolvida pelo Claude: " + item.variantId);

    const clubPrice = club?.productPrices.find((p) => p.productId === variant.productId);
    const unitPrice = item.unitPrice ?? (clubPrice ? Number(clubPrice.unitPrice) : Number(variant.price));

    return {
      variantId: variant.id,
      title: `${variant.product.title} - ${variant.title}`,
      quantity: item.quantity,
      unitPrice,
      unitCost: Number(variant.unitCost ?? 0),
    };
  });

  const draft: Draft = {
    clubId: club?.id ?? null,
    clubName: club?.name ?? null,
    items,
    notes: parsed.notes,
    createdAt: Date.now(),
  };
  drafts.set(chatId, draft);

  const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const lines = items.map((i) => `${i.quantity}x ${i.title} a ${i.unitPrice.toFixed(2)}€`);
  const warn = parsed.warnings.length ? "\n\n⚠️ " + parsed.warnings.join("\n⚠️ ") : "";

  await sendMessage(
    `Confirma esta venda?\n\n` +
      `Clube/cliente: ${draft.clubName ?? "(sem clube)"}\n` +
      lines.join("\n") +
      `\nTotal: ${total.toFixed(2)}€` +
      warn +
      `\n\nResponde SIM para gravar ou CANCELAR.`,
  );
}

async function confirmDraft(chatId: string, draft: Draft) {
  const store = await prisma.store.findFirst();
  if (!store) throw new Error("Nenhuma store encontrada");

  const subtotal = draft.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const cogsTotal = draft.items.reduce((s, i) => s + i.unitCost * i.quantity, 0);
  const grossProfit = subtotal - cogsTotal;
  const movementType: StockMovementType = draft.clubId ? "CLUB_SALE" : "MANUAL_SALE";

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.manualSale.create({
      data: {
        storeId: store.id,
        channel: draft.clubId ? "CLUB" : "MANUAL",
        clubId: draft.clubId,
        notes: draft.notes ?? "Registado via Telegram",
        soldAt: new Date(),
        subtotal: subtotal.toFixed(2),
        total: subtotal.toFixed(2),
        cogsTotal: cogsTotal.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        netProfit: grossProfit.toFixed(2),
        items: {
          create: draft.items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            unitPrice: i.unitPrice.toFixed(2),
            unitCost: i.unitCost.toFixed(2),
            totalRevenue: (i.unitPrice * i.quantity).toFixed(2),
            totalCost: (i.unitCost * i.quantity).toFixed(2),
          })),
        },
      },
    });

    for (const item of draft.items) {
      await consumeStock(tx, {
        storeId: store.id,
        variantId: item.variantId,
        saleQty: item.quantity,
        type: movementType,
        reference: created.id,
      });
    }

    return created;
  });

  drafts.delete(chatId);
  await sendMessage(`✅ Venda registada (${subtotal.toFixed(2)}€). Já está na app.`);
  return sale;
}

async function handleMessage(chatId: string, text: string) {
  const draft = drafts.get(chatId);
  const isExpired = draft && Date.now() - draft.createdAt > DRAFT_TTL_MS;
  if (isExpired) drafts.delete(chatId);

  const pending = isExpired ? undefined : draft;
  const normalized = text.trim().toLowerCase();

  if (pending) {
    if (["sim", "confirmo", "confirmar", "yes", "ok"].includes(normalized)) {
      try {
        await confirmDraft(chatId, pending);
      } catch (err) {
        await sendMessage("Erro ao gravar: " + (err instanceof Error ? err.message : String(err)));
      }
      return;
    }
    if (["cancelar", "cancel", "não", "nao"].includes(normalized)) {
      drafts.delete(chatId);
      await sendMessage("Cancelado.");
      return;
    }
    // Nova mensagem enquanto havia um draft pendente: descarta o antigo e trata como novo pedido.
    drafts.delete(chatId);
  }

  await handleNewSaleText(chatId, text);
}

async function pollLoop() {
  let offset = 0;
  console.log("Bot de Telegram a correr. Ctrl+C para parar.");

  while (true) {
    try {
      const res = await fetch(`${API}/getUpdates?offset=${offset}&timeout=30`);
      const data = await res.json();

      for (const update of data.result ?? []) {
        offset = update.update_id + 1;
        const msg = update.message;
        if (!msg || !msg.text) continue;
        if (String(msg.chat.id) !== CHAT_ID) continue;

        console.log("Recebido:", msg.text);
        await handleMessage(String(msg.chat.id), msg.text);
      }
    } catch (err) {
      console.error("Erro no polling:", err);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

pollLoop();

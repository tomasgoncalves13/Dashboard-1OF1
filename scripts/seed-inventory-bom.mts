/**
 * Seeds physical inventory items + bill-of-materials recipes (VariantComponent).
 * Idempotent: wipes inventory items + components for the store, then rebuilds.
 *
 * Mapping rules confirmed with the user — see plan file.
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const COLORS = ["Preto", "Branco", "Vermelho", "Azul", "Verde", "Amarelo"];
const slug = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "");

type ItemDef = { code: string; name: string; family: string; unitCost: number | null; stock: number };

function buildItems(): ItemDef[] {
  const items: ItemDef[] = [];

  // Built-In Shin Pads (Encomenda 3 stock)
  const builtIn: Record<string, number> = { S: 400, M: 350, L: 250, XL: 50 };
  for (const [size, stock] of Object.entries(builtIn)) {
    items.push({ code: `BUILTIN-${size}`, name: `Built-In Shin Pad ${size}`, family: "Built-In Shin Pads", unitCost: 2.84, stock });
  }

  // Mini Shin Pads (size+color). M=10x6, S=8x5; Silver=Cinza
  const miniStock: Record<string, number> = {
    "MINI-10X6-PRETO": 100, "MINI-10X6-CINZA": 125, "MINI-8X5-CINZA": 30, "MINI-8X5-PRETO": 30,
  };
  for (const size of ["10x6", "8x5"]) {
    for (const color of ["Cinza", "Preto"]) {
      const code = `MINI-${slug(size)}-${slug(color)}`;
      items.push({ code, name: `Mini Shin Pad ${size} ${color}`, family: "Mini Shin Pads", unitCost: 1.65, stock: miniStock[code] ?? 0 });
    }
  }

  // Airflow (2 sizes)
  for (const size of ["15X9", "9X6"]) {
    items.push({ code: `AIRFLOW-${size}`, name: `Airflow ${size}`, family: "Airflow", unitCost: 1.67, stock: 50 });
  }

  // Grip Socks — one item per color × adult/kids (no size band: adult=40-48, kids=36-40)
  const gripAdult: Record<string, number> = { Preto: 100, Branco: 800, Vermelho: 100, Azul: 100, Verde: 100, Amarelo: 100 };
  const gripKids: Record<string, number> = { Preto: 50, Branco: 400, Vermelho: 50, Azul: 50, Verde: 50, Amarelo: 50 };
  for (const color of COLORS) {
    items.push({ code: `GRIP-A-${slug(color)}`, name: `Grip Sock ${color} (Adulto)`, family: "Grip Socks", unitCost: 0.88, stock: gripAdult[color] ?? 0 });
    items.push({ code: `GRIP-K-${slug(color)}`, name: `Grip Sock ${color} (Kids)`, family: "Grip Socks", unitCost: 0.88, stock: gripKids[color] ?? 0 });
  }

  // Sock Sleeves adult + kids (color × age)
  const sleeveAdult: Record<string, number> = { Preto: 40, Branco: 15, Vermelho: 15, Azul: 15, Verde: 20, Amarelo: 20 };
  const sleeveKids: Record<string, number> = { Preto: 10, Branco: 5, Vermelho: 5, Azul: 5, Verde: 0, Amarelo: 0 };
  for (const color of COLORS) {
    items.push({ code: `SLEEVE-A-${slug(color)}`, name: `Sock Sleeve ${color} (Adulto)`, family: "Sock Sleeves", unitCost: 0.88, stock: sleeveAdult[color] ?? 0 });
    items.push({ code: `SLEEVE-K-${slug(color)}`, name: `Sock Sleeve ${color} (Kids)`, family: "Sock Sleeves", unitCost: 0.88, stock: sleeveKids[color] ?? 0 });
  }

  // Simple 1:1 products — one item per variant, stock 0
  const simples = [
    { product: "Snood", variant: "Default Title", name: "Snood" },
    { product: "Beanie", variant: "Default Title", name: "Beanie" },
    { product: "Gloves", variant: "Default Title", name: "Gloves" },
    { product: "Tape Desportivo", variant: "Branco", name: "Tape Desportivo Branco" },
    { product: "Tape Desportivo", variant: "Preto", name: "Tape Desportivo Preto" },
    { product: "Pocket for Shin Pads", variant: "Black", name: "Pocket for Shin Pads Black" },
    { product: "Pocket for Shin Pads", variant: "White", name: "Pocket for Shin Pads White" },
  ];
  for (const s of simples) {
    items.push({ code: `SIMPLE-${slug(s.product)}-${slug(s.variant)}`, name: s.name, family: "Outros", unitCost: null, stock: 0 });
  }

  return items;
}

// ── Recipe resolver: variant → [{ code, qty }] ──────────────────
function colorOf(title: string): string | null {
  for (const c of COLORS) if (title.includes(c)) return c;
  return null;
}
const PACK_SIZE_ADULT: Record<string, string> = { MAXI: "XL", MIDI: "L", MINI: "M" };
const PACK_SIZE_KIDS: Record<string, string> = { MIDI: "M", MINI: "S" };

function recipeFor(productTitle: string, variantTitle: string): { code: string; qty: number }[] | null {
  const pt = productTitle;
  const vt = variantTitle;

  // Built-In Shin Pads (adult product)
  if (pt === "Built-In Shin Pads") {
    if (vt.includes("Adulto")) {
      if (vt.includes("Pequeno")) return [{ code: "BUILTIN-M", qty: 1 }];
      if (vt.includes("Médio")) return [{ code: "BUILTIN-L", qty: 1 }];
      if (vt.includes("Grande")) return [{ code: "BUILTIN-XL", qty: 1 }];
    }
    if (vt.includes("Criança")) {
      if (vt.includes("Pequeno")) return [{ code: "BUILTIN-S", qty: 1 }];
      if (vt.includes("Médio")) return [{ code: "BUILTIN-M", qty: 1 }];
      if (vt.includes("Grande")) return [{ code: "BUILTIN-L", qty: 1 }];
    }
    return null;
  }
  if (pt === "Kids Built-In Shin Pads") {
    if (vt.includes("MIDI")) return [{ code: "BUILTIN-M", qty: 1 }];
    if (vt.includes("MINI")) return [{ code: "BUILTIN-S", qty: 1 }];
    return null;
  }

  // Mini Shin Pads (adult + kids share)
  if (pt === "Mini Shin Pads" || pt === "Kids Mini Shin Pads") {
    const size = /10\s?[xX]\s?6/.test(vt) ? "10x6" : /8\s?[xX]\s?5/.test(vt) ? "8x5" : null;
    const color = vt.includes("Cinza") ? "Cinza" : vt.includes("Preto") ? "Preto" : null;
    if (size && color) return [{ code: `MINI-${slug(size)}-${slug(color)}`, qty: 1 }];
    return null;
  }

  // Airflow (adult + kids share)
  if (pt === "Airflow Pro" || pt === "Kids Airflow Pro") {
    const size = vt.replace(/\s/g, "").toUpperCase().includes("15X9") ? "15X9" : "9X6";
    return [{ code: `AIRFLOW-${size}`, qty: 1 }];
  }

  // Grip Socks (adult: Pro Grip Socks + legacy Grip Socks share). No band split.
  if (pt === "Pro Grip Socks" || pt === "Grip Socks") {
    const color = colorOf(vt);
    if (color) return [{ code: `GRIP-A-${slug(color)}`, qty: 1 }];
    return null;
  }
  if (pt === "Kids Pro Grip Socks") {
    const color = colorOf(vt);
    if (color) return [{ code: `GRIP-K-${slug(color)}`, qty: 1 }];
    return null;
  }

  // Sock Sleeves
  if (pt === "Sock Sleeve") {
    const color = colorOf(vt);
    const age = vt.includes("Criança") ? "K" : "A";
    if (color) return [{ code: `SLEEVE-${age}-${slug(color)}`, qty: 1 }];
    return null;
  }
  if (pt === "Kids Sock Sleeves") {
    const color = colorOf(vt);
    if (color) return [{ code: `SLEEVE-K-${slug(color)}`, qty: 1 }];
    return null;
  }

  // Grip sock bundles (adult)
  if (pt === "12 Pair Bundle - Pro Grip Socks" || pt === "Exclusive 6 Pair Bundle - Pro Grip Socks") {
    const color = colorOf(vt);
    const qty = pt.startsWith("12") ? 12 : 6;
    if (color) return [{ code: `GRIP-A-${slug(color)}`, qty }];
    return null;
  }

  // Conjunto Pro (adult + child variants) and the separate Crianças product
  if (pt === "Conjunto Pro - Caneleiras Embutidas") {
    const color = colorOf(vt);
    const packSize = vt.includes("MAXI") ? "MAXI" : vt.includes("MIDI") ? "MIDI" : "MINI";
    if (!color) return null;
    if (vt.includes("Adulto")) {
      return [
        { code: `BUILTIN-${PACK_SIZE_ADULT[packSize]}`, qty: 1 },
        { code: `GRIP-A-${slug(color)}`, qty: 6 },
        { code: `SLEEVE-A-${slug(color)}`, qty: 2 },
      ];
    }
    if (vt.includes("Criança")) {
      if (packSize === "MAXI") return null; // no kids MAXI pack
      return [
        { code: `BUILTIN-${PACK_SIZE_KIDS[packSize]}`, qty: 1 },
        { code: `GRIP-K-${slug(color)}`, qty: 6 },
        { code: `SLEEVE-K-${slug(color)}`, qty: 2 },
      ];
    }
    return null;
  }
  if (pt === "Conjunto Pro - Caneleiras Embutidas Crianças") {
    const color = colorOf(vt);
    const packSize = vt.includes("MIDI") ? "MIDI" : "MINI";
    if (!color) return null;
    return [
      { code: `BUILTIN-${PACK_SIZE_KIDS[packSize]}`, qty: 1 },
      { code: `GRIP-K-${slug(color)}`, qty: 6 },
      { code: `SLEEVE-K-${slug(color)}`, qty: 2 },
    ];
  }

  // Simple 1:1 products
  const simpleMap: Record<string, string> = {
    "Snood": "SIMPLE-SNOOD-DEFAULT-TITLE",
    "Beanie": "SIMPLE-BEANIE-DEFAULT-TITLE",
    "Gloves": "SIMPLE-GLOVES-DEFAULT-TITLE",
  };
  if (simpleMap[pt]) return [{ code: simpleMap[pt], qty: 1 }];
  if (pt === "Tape Desportivo") {
    const color = vt.includes("Branco") ? "BRANCO" : "PRETO";
    return [{ code: `SIMPLE-TAPE-DESPORTIVO-${color}`, qty: 1 }];
  }
  if (pt === "Pocket for Shin Pads") {
    const c = vt.toLowerCase().includes("white") ? "WHITE" : "BLACK";
    return [{ code: `SIMPLE-POCKET-FOR-SHIN-PADS-${c}`, qty: 1 }];
  }

  return null;
}

async function main() {
  const store = await p.store.findFirst();
  if (!store) throw new Error("No store");

  // Wipe
  await p.variantComponent.deleteMany({ where: { inventoryItem: { storeId: store.id } } });
  await p.inventoryItem.deleteMany({ where: { storeId: store.id } });

  // Create items
  const itemDefs = buildItems();
  const codeToId = new Map<string, string>();
  for (const it of itemDefs) {
    const created = await p.inventoryItem.create({
      data: {
        storeId: store.id, code: it.code, name: it.name, family: it.family,
        unitCost: it.unitCost === null ? null : it.unitCost.toFixed(2),
        stockOnHand: it.stock,
      },
    });
    codeToId.set(it.code, created.id);
  }
  console.log(`✓ ${itemDefs.length} itens físicos criados`);

  // Create recipes
  const variants = await p.productVariant.findMany({
    where: { storeId: store.id },
    include: { product: { select: { title: true } } },
  });

  let linked = 0;
  const unmatched: string[] = [];
  for (const v of variants) {
    const recipe = recipeFor(v.product.title, v.title);
    if (!recipe) { unmatched.push(`${v.product.title} | ${v.title}`); continue; }
    for (const r of recipe) {
      const itemId = codeToId.get(r.code);
      if (!itemId) { console.log(`  ⚠ código não encontrado: ${r.code} (${v.product.title} | ${v.title})`); continue; }
      await p.variantComponent.create({
        data: { variantId: v.id, inventoryItemId: itemId, quantity: r.qty },
      });
    }
    linked++;
  }

  console.log(`✓ ${linked} variantes ligadas`);
  console.log(`\n⚠ ${unmatched.length} variantes SEM receita (verifica):`);
  unmatched.forEach((u) => console.log(`  - ${u}`));

  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

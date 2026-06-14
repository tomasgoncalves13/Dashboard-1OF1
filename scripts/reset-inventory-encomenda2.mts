import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

// Encomenda 3: Built-In Shin Pads — S=400, M=350, L=250, XL=50
// Mapped to Adulto variants (Pequeno=S, Médio=M, Grande=L). XL not matched → user adjusts.
const builtInStock: Record<string, number> = {
  "Adulto (12+) / Pequeno": 400,
  "Adulto (12+) / Médio":   350,
  "Adulto (12+) / Grande":  250,
};

// Encomenda 4: Grip Socks Adulto — mapped to Pro Grip Socks, split 50/50 between EU 36-40 and EU 40-48
const gripAdulto: Record<string, number> = { Preto: 50, Branco: 800, Vermelho: 100, Azul: 100, Verde: 100, Amarelo: 100 };
// Encomenda 4: Grip Socks Criança — Kids Pro Grip Socks
const gripCrianca: Record<string, number> = { Preto: 50, Branco: 400, Vermelho: 50, Azul: 50, Verde: 50, Amarelo: 50 };
// Encomenda 4: Sock Sleeves Adulto
const sleeveAdulto: Record<string, number> = { Preto: 40, Branco: 15, Vermelho: 15, Azul: 15, Verde: 20, Amarelo: 20 };
// Encomenda 4: Sock Sleeves Criança
const sleeveCrianca: Record<string, number> = { Preto: 10, Branco: 5, Vermelho: 5, Azul: 5, Verde: 0, Amarelo: 0 };

async function main() {
  const store = await p.store.findFirst();
  if (!store) throw new Error("No store found");

  // 1. Zero out ALL variants
  await p.productVariant.updateMany({ where: { storeId: store.id }, data: { stockOnHand: 0 } });
  console.log("✓ Reset all stock to 0\n");

  const variants = await p.productVariant.findMany({
    where: { storeId: store.id },
    include: { product: { select: { title: true } } },
  });

  const updates: { id: string; stock: number; label: string }[] = [];

  for (const v of variants) {
    const prod = v.product.title;
    const title = v.title;
    let stock = 0;

    // Built-In Shin Pads (Adulto sizes)
    if (prod === "Built-In Shin Pads" && builtInStock[title] !== undefined) {
      stock = builtInStock[title];
    }

    // Pro Grip Socks (Adulto) — split 50/50 per color between sizes
    else if (prod === "Pro Grip Socks") {
      const color = title.split(" / ")[0];
      const total = gripAdulto[color] ?? 0;
      stock = Math.round(total / 2);
    }

    // Kids Pro Grip Socks (Criança)
    else if (prod === "Kids Pro Grip Socks") {
      const color = title.split(" / ")[0];
      const total = gripCrianca[color] ?? 0;
      stock = Math.round(total / 2);
    }

    // Sock Sleeve (Adulto + Criança — by variant name)
    else if (prod === "Sock Sleeve") {
      const [color, age] = title.split(" / ");
      if (age?.includes("Adulto")) stock = sleeveAdulto[color] ?? 0;
      else if (age?.includes("Criança")) stock = sleeveCrianca[color] ?? 0;
    }

    // Kids Sock Sleeves
    else if (prod === "Kids Sock Sleeves") {
      stock = sleeveCrianca[title] ?? 0;
    }

    if (stock > 0) {
      updates.push({ id: v.id, stock, label: `${prod} | ${title}` });
    }
  }

  // Apply updates + create StockMovement entries
  for (const { id, stock, label } of updates) {
    await p.productVariant.update({ where: { id }, data: { stockOnHand: stock } });
    await p.stockMovement.create({
      data: {
        storeId: store.id,
        variantId: id,
        type: "PURCHASE",
        quantity: stock,
        reference: "Encomenda 3/4",
        note: "Reset inventário — Encomenda 2 (Jan 2026)",
      },
    });
    console.log(`✓ ${label} → ${stock}`);
  }

  console.log(`\n✓ ${updates.length} variantes atualizadas`);
  console.log("⚠  Variantes a 0 que precisas de verificar:");
  const zeros = variants.filter(
    (v) => !updates.find((u) => u.id === v.id) &&
      ["Built-In Shin Pads", "Pro Grip Socks", "Kids Pro Grip Socks", "Grip Socks", "Sock Sleeve", "Kids Sock Sleeves"].includes(v.product.title)
  );
  zeros.forEach((v) => console.log(`  - ${v.product.title} | ${v.title}`));

  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

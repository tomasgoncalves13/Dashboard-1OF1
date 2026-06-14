import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const updates = [
  { contains: "12 Pair Bundle",       cost: (12 * 0.88).toFixed(2) },   // 10.56
  { contains: "Exclusive 6 Pair",     cost: (6 * 0.88).toFixed(2) },    // 5.28
  { contains: "Conjunto Pro",         cost: (2.84 + 6*0.88 + 2*0.88).toFixed(2) }, // 9.88
];

async function main() {
  for (const { contains, cost } of updates) {
    const products = await p.product.findMany({
      where: { title: { contains, mode: "insensitive" } },
      select: { title: true, id: true },
    });
    for (const prod of products) {
      await p.productVariant.updateMany({ where: { productId: prod.id }, data: { unitCost: cost } });
      console.log(`✓  ${prod.title} → ${cost}€`);
    }
    if (products.length === 0) console.log(`⚠  Nenhum produto encontrado para "${contains}"`);
  }
  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

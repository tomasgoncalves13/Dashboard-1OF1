import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const products = await p.product.findMany({
  where: { title: { in: ["Caneleiras Embutidas", "Meias Antiderrapantes", "Caneleiras Mini", "Airflow Pro"] } },
  include: { variants: { select: { id: true, title: true, price: true, unitCost: true, stockOnHand: true } } },
});
for (const prod of products) {
  console.log(`\n=== ${prod.title} (${prod.id}) ===`);
  for (const v of prod.variants) {
    console.log(`  ${v.id} | "${v.title}" | preco=${v.price} | custo=${v.unitCost} | stock=${v.stockOnHand}`);
  }
}
await p.$disconnect();

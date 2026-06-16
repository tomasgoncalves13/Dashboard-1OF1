import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst();
  if (!store) throw new Error("No store");

  const canidelo = await p.club.findFirst({ where: { storeId: store.id, name: { contains: "Canidelo", mode: "insensitive" } } });
  console.log(`Club: ${canidelo?.name} (${canidelo?.id})`);

  const sales = await p.manualSale.findMany({
    where: { storeId: store.id, clubId: canidelo?.id },
    include: { items: { include: { variant: { select: { title: true, product: { select: { title: true } } } } } } },
    orderBy: { soldAt: "desc" },
  });

  for (const s of sales) {
    console.log(`\nID: ${s.id}`);
    console.log(`  Data: ${s.soldAt.toLocaleDateString("pt-PT")} · €${s.total}`);
    s.items.forEach(i => console.log(`  ${i.quantity}× ${i.variant.product.title} ${i.variant.title} @ €${i.unitPrice}`));
  }

  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

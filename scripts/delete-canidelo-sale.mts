import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const SALE_ID = "cmqfqra760001jv04th4xf6ow";

async function main() {
  const store = await p.store.findFirst();
  if (!store) throw new Error("No store");

  const sale = await p.manualSale.findUnique({
    where: { id: SALE_ID },
    include: { items: true, club: { select: { name: true } } },
  });
  if (!sale) throw new Error(`Sale ${SALE_ID} not found`);
  console.log(`Found: ${sale.club?.name} · €${sale.total} · ${sale.items.length} items`);

  await p.$transaction(async (tx) => {
    const movements = await tx.stockMovement.findMany({
      where: { reference: SALE_ID, storeId: store.id },
      include: { inventoryItem: true },
    });
    for (const m of movements) {
      if (!m.inventoryItemId) continue;
      const restore = Math.abs(m.quantity);
      await tx.inventoryItem.update({
        where: { id: m.inventoryItemId },
        data: { stockOnHand: { increment: restore } },
      });
      console.log(`+${restore} → ${m.inventoryItem?.name}`);
    }
    await tx.stockMovement.deleteMany({ where: { reference: SALE_ID, storeId: store.id } });
    await tx.manualSaleItem.deleteMany({ where: { manualSaleId: SALE_ID } });
    await tx.manualSale.delete({ where: { id: SALE_ID } });
  });

  console.log("✅ Venda eliminada.");
  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

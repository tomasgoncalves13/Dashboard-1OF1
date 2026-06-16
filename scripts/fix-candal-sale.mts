import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const WRONG_SALE_ID = "cmqfqnkqq0001l704lgtnnstp";

async function main() {
  const store = await p.store.findFirst();
  if (!store) throw new Error("No store");

  // 1. Verify wrong sale
  const wrongSale = await p.manualSale.findUnique({
    where: { id: WRONG_SALE_ID },
    include: { items: true },
  });
  if (!wrongSale) throw new Error(`Sale ${WRONG_SALE_ID} not found`);
  console.log(`Found wrong sale: €${wrongSale.total} · ${wrongSale.items.length} items → will be deleted`);

  // 2. Find Candal club
  const candal = await p.club.findFirst({ where: { storeId: store.id, name: { contains: "Candal", mode: "insensitive" } } });
  if (!candal) throw new Error("Club 'Candal' not found");
  console.log(`Club: ${candal.name} (${candal.id})`);

  // 3. Find Kids Built-In Shin Pads MINI variant
  const miniVariant = await p.productVariant.findFirst({
    where: {
      storeId: store.id,
      product: { title: "Kids Built-In Shin Pads" },
      title: "MINI",
    },
    include: {
      components: {
        include: { inventoryItem: { select: { id: true, name: true, stockOnHand: true, unitCost: true } } },
      },
    },
  });
  if (!miniVariant) throw new Error("Kids Built-In Shin Pads MINI variant not found");
  console.log(`Variant: Kids Built-In Shin Pads | MINI (${miniVariant.id})`);
  console.log(`  unitCost: €${miniVariant.unitCost}`);

  const unitCost = Number(miniVariant.unitCost ?? miniVariant.components[0]?.inventoryItem?.unitCost ?? 0);
  const unitPrice = 115 / 2; // €57.50 each, total €115
  const qty = 2;

  // ── Execute in transaction ──
  await p.$transaction(async (tx) => {
    // A. Reverse stock: find movements from the wrong sale and add back
    const movements = await tx.stockMovement.findMany({
      where: { reference: WRONG_SALE_ID, storeId: store.id },
      include: { inventoryItem: true },
    });
    console.log(`\nReversing ${movements.length} stock movement(s)...`);
    for (const m of movements) {
      if (!m.inventoryItemId) continue;
      // quantity is negative (sale consumed stock), add back the absolute value
      const restore = Math.abs(m.quantity);
      await tx.inventoryItem.update({
        where: { id: m.inventoryItemId },
        data: { stockOnHand: { increment: restore } },
      });
      console.log(`  +${restore} → ${m.inventoryItem?.name ?? m.inventoryItemId}`);
    }
    await tx.stockMovement.deleteMany({ where: { reference: WRONG_SALE_ID, storeId: store.id } });

    // B. Delete wrong sale items + sale
    await tx.manualSaleItem.deleteMany({ where: { manualSaleId: WRONG_SALE_ID } });
    await tx.manualSale.delete({ where: { id: WRONG_SALE_ID } });
    console.log(`\n✓ Deleted wrong sale`);

    // C. Create correct sale: 2× Kids Built-In Shin Pads MINI to Candal on 01/06/2026, total €115
    const subtotal = unitPrice * qty;
    const cogsTotal = unitCost * qty;
    const grossProfit = subtotal - cogsTotal;

    const newSale = await tx.manualSale.create({
      data: {
        storeId: store.id,
        channel: "CLUB",
        clubId: candal.id,
        soldAt: new Date("2026-06-01T12:00:00Z"),
        subtotal: subtotal.toFixed(2),
        total: subtotal.toFixed(2),
        cogsTotal: cogsTotal.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        netProfit: grossProfit.toFixed(2),
        items: {
          create: [{
            variantId: miniVariant.id,
            quantity: qty,
            unitPrice: unitPrice.toFixed(2),
            unitCost: unitCost.toFixed(2),
            totalRevenue: subtotal.toFixed(2),
            totalCost: cogsTotal.toFixed(2),
          }],
        },
      },
    });
    console.log(`✓ Created new sale ${newSale.id} → €${newSale.total} to ${candal.name} on 2026-06-01`);

    // D. Consume stock via BOM
    for (const comp of miniVariant.components) {
      const consumed = comp.quantity * qty;
      await tx.inventoryItem.update({
        where: { id: comp.inventoryItemId },
        data: { stockOnHand: { decrement: consumed } },
      });
      await tx.stockMovement.create({
        data: {
          storeId: store.id,
          inventoryItemId: comp.inventoryItemId,
          type: "CLUB_SALE",
          quantity: -consumed,
          reference: newSale.id,
          note: `Candal 01/06/2026 — Kids Built-In Shin Pads MINI ×${qty}`,
        },
      });
      console.log(`  −${consumed} → ${comp.inventoryItem.name} (stock was ${comp.inventoryItem.stockOnHand})`);
    }
  });

  console.log("\n✅ Done.");
  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

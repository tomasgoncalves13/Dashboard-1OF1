import { PrismaClient, type StockMovementType } from "@prisma/client";

// Duplicado de src/lib/inventory/consume.ts (ver telegram-bot.mts para explicação).
async function consumeStock(
  tx: any,
  args: { storeId: string; variantId: string; saleQty: number; type: StockMovementType; reference?: string },
) {
  const components = await tx.variantComponent.findMany({ where: { variantId: args.variantId } });
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
}

const prisma = new PrismaClient();

const CLUB_ID = "cmqfk9tkn0003jl04dkjdx3qm"; // Canidelo (commissionEnabled: true, 25/30/35 tiers)

const items = [
  { variantId: "cmp4m66ug000evueofpxhs98t", quantity: 1, unitPrice: 20.00, unitCost: 2.84 }, // Caneleiras Embutidas Adulto S
  { variantId: "cmp4mgdo2008dvum84tn0frru", quantity: 3, unitPrice: 10.00, unitCost: 0.88 }, // Meias Antid. Branco EU36-40
  { variantId: "cmp4mgf7i008tvum82x6y6edh", quantity: 1, unitPrice: 10.00, unitCost: 0.88 }, // Meias Antid. Verde EU36-40
  { variantId: "cmp4mfq36001lvum8bm7ixsoh", quantity: 2, unitPrice: 15.00, unitCost: 1.65 }, // Caneleiras Mini Cinza 8x5
];

const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
const cogsTotal = items.reduce((s, i) => s + i.unitCost * i.quantity, 0);
const grossProfit = subtotal - cogsTotal;

if (Math.round(subtotal * 100) !== 9000) {
  throw new Error(`Subtotal ${subtotal.toFixed(2)} != 90.00 — abortando`);
}

const store = await prisma.store.findFirst();
if (!store) throw new Error("Nenhuma store encontrada");

const sale = await prisma.$transaction(async (tx) => {
  const created = await tx.manualSale.create({
    data: {
      storeId: store.id,
      channel: "CLUB",
      clubId: CLUB_ID,
      soldAt: new Date(),
      subtotal: subtotal.toFixed(2),
      total: subtotal.toFixed(2),
      cogsTotal: cogsTotal.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      netProfit: grossProfit.toFixed(2),
      items: {
        create: items.map((i) => ({
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

  for (const item of items) {
    await consumeStock(tx, {
      storeId: store.id,
      variantId: item.variantId,
      saleQty: item.quantity,
      type: "CLUB_SALE",
      reference: created.id,
    });
  }

  return created;
});

console.log(`Venda registada: ${sale.id} — ${subtotal.toFixed(2)}€ (custo ${cogsTotal.toFixed(2)}€, lucro bruto ${grossProfit.toFixed(2)}€, comissao 25% ~22.50€, recebido ~67.50€)`);
await prisma.$disconnect();

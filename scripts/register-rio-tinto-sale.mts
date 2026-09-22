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

const CLUB_ID = "cmqfk9zwj0005jl04p9625ndd"; // Rio Tinto (commissionEnabled: false)

const items = [
  { variantId: "cmp4m66ug000evueofpxhs98t", quantity: 5, unitPrice: 11.30, unitCost: 2.84 }, // Caneleiras Embutidas Adulto S
  { variantId: "cmp4mfhwt0007vum8xgu1chml", quantity: 4, unitPrice: 11.27, unitCost: 2.84 }, // Caneleiras Embutidas Adulto M
  { variantId: "cmp4mfiau0009vum8opdzrvio", quantity: 5, unitPrice: 11.30, unitCost: 2.84 }, // Caneleiras Embutidas Adulto L
  { variantId: "cmp4mgfeg008vvum8uclrlr3b", quantity: 4, unitPrice: 4.89, unitCost: 0.88 },  // Meias Antid. Amarelo EU40-48
  { variantId: "cmp4mgdv2008fvum8vjifywkq", quantity: 5, unitPrice: 4.89, unitCost: 0.88 },  // Meias Antid. Preto EU40-48
  { variantId: "cmp4mgdgy008bvum8579hahzh", quantity: 4, unitPrice: 4.89, unitCost: 0.88 },  // Meias Antid. Branco EU40-48
  { variantId: "cmp4mfpwa001jvum84wo8zeze", quantity: 5, unitPrice: 7.55, unitCost: 1.65 },  // Caneleiras Mini Preto 8x5 (mini)
  { variantId: "cmp4mfqa1001nvum8hj1yv5w6", quantity: 3, unitPrice: 7.55, unitCost: 1.65 },  // Caneleiras Mini Preto 10x6 (grande)
  { variantId: "cmp4mfq36001lvum8bm7ixsoh", quantity: 5, unitPrice: 7.55, unitCost: 1.65 },  // Caneleiras Mini Cinza 8x5 (mini)
  { variantId: "cmp4mfqgw001pvum84vglesep", quantity: 1, unitPrice: 7.55, unitCost: 1.65 },  // Caneleiras Mini Cinza 10x6 (grande)
  { variantId: "cmp4mfpbf001dvum8805q1ro8", quantity: 1, unitPrice: 7.55, unitCost: 1.67 },  // Airflow Pro 9X6CM (mini)
  { variantId: "cmp4mfpia001fvum8rl7uuh9b", quantity: 2, unitPrice: 7.55, unitCost: 1.67 },  // Airflow Pro 15X9CM (maxi)
];

const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
const cogsTotal = items.reduce((s, i) => s + i.unitCost * i.quantity, 0);
const grossProfit = subtotal - cogsTotal;

if (Math.round(subtotal * 100) !== 35000) {
  throw new Error(`Subtotal ${subtotal.toFixed(2)} != 350.00 — abortando`);
}

const store = await prisma.store.findFirst();
if (!store) throw new Error("Nenhuma store encontrada");

const sale = await prisma.$transaction(async (tx) => {
  const created = await tx.manualSale.create({
    data: {
      storeId: store.id,
      channel: "CLUB",
      clubId: CLUB_ID,
      notes: "Sem comissão",
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

console.log(`Venda registada: ${sale.id} — ${subtotal.toFixed(2)}€ (custo ${cogsTotal.toFixed(2)}€, lucro ${grossProfit.toFixed(2)}€)`);
await prisma.$disconnect();

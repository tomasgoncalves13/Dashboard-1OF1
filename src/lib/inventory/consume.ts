import { Prisma, type StockMovementType } from "@prisma/client";

/**
 * Bill-of-materials stock engine.
 *
 * Sellable variants no longer hold stock directly. Each variant has a recipe
 * (VariantComponent[]) pointing to one or more physical InventoryItems with a
 * quantity. Selling a variant decrements the linked physical items via the recipe.
 *
 * All functions take a Prisma transaction client so callers can wrap the sale
 * record + stock movements in a single atomic operation.
 */

type TxClient = Prisma.TransactionClient;

/**
 * Decrement physical stock for `saleQty` units of a sellable variant, following
 * its recipe. Writes a StockMovement per physical item consumed. If the variant
 * has no recipe, does nothing (safe fallback) and returns false.
 */
export async function consumeStock(
  tx: TxClient,
  args: {
    storeId: string;
    variantId: string;
    saleQty: number;
    type: StockMovementType;
    reference?: string;
    note?: string;
    createdBy?: string;
  },
): Promise<boolean> {
  const components = await tx.variantComponent.findMany({
    where: { variantId: args.variantId },
  });
  if (components.length === 0) return false;

  for (const c of components) {
    const qty = c.quantity * args.saleQty;
    await tx.inventoryItem.update({
      where: { id: c.inventoryItemId },
      data: { stockOnHand: { decrement: qty } },
    });
    await tx.stockMovement.create({
      data: {
        storeId: args.storeId,
        inventoryItemId: c.inventoryItemId,
        variantId: args.variantId,
        type: args.type,
        quantity: -qty,
        reference: args.reference,
        note: args.note,
        createdBy: args.createdBy,
      },
    });
  }
  return true;
}

/**
 * Restore physical stock for `saleQty` units of a variant (e.g. on sale deletion
 * or return). Increments the linked physical items and writes RETURN movements.
 */
export async function restoreStock(
  tx: TxClient,
  args: {
    storeId: string;
    variantId: string;
    saleQty: number;
    reference?: string;
    note?: string;
    createdBy?: string;
  },
): Promise<boolean> {
  const components = await tx.variantComponent.findMany({
    where: { variantId: args.variantId },
  });
  if (components.length === 0) return false;

  for (const c of components) {
    const qty = c.quantity * args.saleQty;
    await tx.inventoryItem.update({
      where: { id: c.inventoryItemId },
      data: { stockOnHand: { increment: qty } },
    });
    await tx.stockMovement.create({
      data: {
        storeId: args.storeId,
        inventoryItemId: c.inventoryItemId,
        variantId: args.variantId,
        type: "RETURN",
        quantity: qty,
        reference: args.reference,
        note: args.note,
        createdBy: args.createdBy,
      },
    });
  }
  return true;
}

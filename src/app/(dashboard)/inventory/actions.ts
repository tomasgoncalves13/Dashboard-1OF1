"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";

export async function adjustStock(data: {
  inventoryItemId: string;
  type: "ADJUSTMENT" | "PURCHASE" | "LOSS";
  quantity: number;
  note?: string;
}) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthenticated");
  const store = await prisma.store.findFirst({ where: { ownerId: user.id } });
  if (!store) throw new Error("Store not found");

  const item = await prisma.inventoryItem.findFirst({
    where: { id: data.inventoryItemId, storeId: store.id },
  });
  if (!item) throw new Error("Inventory item not found");

  const newStock = item.stockOnHand + data.quantity;
  if (newStock < 0) throw new Error(`Stock insuficiente — actual: ${item.stockOnHand}, ajuste: ${data.quantity}`);

  await prisma.$transaction([
    prisma.inventoryItem.update({
      where: { id: data.inventoryItemId },
      data: { stockOnHand: newStock },
    }),
    prisma.stockMovement.create({
      data: {
        storeId: store.id,
        inventoryItemId: data.inventoryItemId,
        type: data.type,
        quantity: data.quantity,
        note: data.note,
        createdBy: user.id,
      },
    }),
  ]);

  revalidatePath("/inventory");
}

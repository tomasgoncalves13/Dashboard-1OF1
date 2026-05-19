"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";

export async function adjustStock(data: {
  variantId: string;
  type: "ADJUSTMENT" | "PURCHASE" | "LOSS";
  quantity: number;
  note?: string;
}) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthenticated");
  const store = await prisma.store.findFirst({ where: { ownerId: user.id } });
  if (!store) throw new Error("Store not found");

  const variant = await prisma.productVariant.findFirst({
    where: { id: data.variantId, storeId: store.id },
  });
  if (!variant) throw new Error("Variant not found");

  const newStock = variant.stockOnHand + data.quantity;
  if (newStock < 0) throw new Error(`Stock insuficiente — actual: ${variant.stockOnHand}, ajuste: ${data.quantity}`);

  await prisma.$transaction([
    prisma.productVariant.update({
      where: { id: data.variantId },
      data: { stockOnHand: newStock },
    }),
    prisma.stockMovement.create({
      data: {
        storeId: store.id,
        variantId: data.variantId,
        type: data.type,
        quantity: data.quantity,
        note: data.note,
        createdBy: user.id,
      },
    }),
  ]);

  revalidatePath("/inventory");
}

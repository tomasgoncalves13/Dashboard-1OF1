"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { upsertOrderCostConfig } from "@/lib/profit/order-costs";
import { inngest } from "@/lib/inngest/client";

async function getStore() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthenticated");
  const store = await prisma.store.findFirst({ where: { ownerId: user.id } });
  if (!store) throw new Error("Store not found");
  return store;
}

export async function updateVariantCost(variantId: string, unitCost: number) {
  const store = await getStore();
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, storeId: store.id },
  });
  if (!variant) throw new Error("Variant not found");

  await prisma.productVariant.update({
    where: { id: variantId },
    data: { unitCost: unitCost.toFixed(2) },
  });
  revalidatePath("/costs");
}

export async function updateOrderOverheads(data: {
  freeGiftCost: number;
  bubbleMailerCost: number;
  cardCost: number;
  stickerCost: number;
}) {
  const store = await getStore();
  await upsertOrderCostConfig(store.id, data);
  // Trigger retroactive recalculation for all historical orders
  await inngest.send({ name: "profit/recalculate.all", data: { storeId: store.id } });
  revalidatePath("/costs");
  revalidatePath("/orders");
  revalidatePath("/dashboard");
}

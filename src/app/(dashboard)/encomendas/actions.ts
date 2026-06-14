"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";

async function getStore() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthenticated");
  const store = await prisma.store.findFirst({ where: { ownerId: user.id } });
  if (!store) throw new Error("Store not found");
  return store;
}

export type NewOrderItem = {
  productName: string;
  quantity?: number | null;
  productionCost?: number | null;
  transportCost?: number | null;
  totalCost: number;
  unitCost?: number | null;
  note?: string | null;
};

export async function createPurchaseOrder(data: {
  orderNumber: number;
  date: string;
  supplier: string;
  notes?: string;
  items: NewOrderItem[];
}) {
  const store = await getStore();
  const totalCost = data.items.reduce((s, i) => s + i.totalCost, 0);

  await prisma.purchaseOrder.create({
    data: {
      storeId: store.id,
      orderNumber: data.orderNumber,
      date: new Date(data.date),
      supplier: data.supplier,
      notes: data.notes || null,
      totalCost,
      items: { create: data.items },
    },
  });

  revalidatePath("/encomendas");
}

export async function deletePurchaseOrder(id: string) {
  const store = await getStore();
  await prisma.purchaseOrder.deleteMany({ where: { id, storeId: store.id } });
  revalidatePath("/encomendas");
}

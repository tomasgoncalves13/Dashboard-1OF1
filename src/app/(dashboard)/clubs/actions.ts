"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { restoreStock } from "@/lib/inventory/consume";
import {
  createClub,
  updateClub,
  upsertClubProductPrice,
  registerPhysicalSale,
  type SaleItem,
} from "@/lib/clubs/service";

async function getStore() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthenticated");
  const store = await prisma.store.findFirst({ where: { ownerId: user.id } });
  if (!store) throw new Error("Store not found");
  return store;
}

export async function actionCreateClub(data: {
  name: string;
  commissionEnabled: boolean;
  commissionTiers: import("@prisma/client").Prisma.InputJsonValue;
  notes?: string;
}) {
  const store = await getStore();
  await createClub(store.id, data);
  revalidatePath("/clubs");
}

export async function actionUpdateClub(
  clubId: string,
  data: {
    name?: string;
    commissionEnabled?: boolean;
    commissionTiers?: import("@prisma/client").Prisma.InputJsonValue;
    isActive?: boolean;
    notes?: string;
  },
) {
  const store = await getStore();
  await updateClub(store.id, clubId, data);
  revalidatePath("/clubs");
  revalidatePath(`/clubs/${clubId}`);
}

export async function actionUpsertClubPrice(
  clubId: string,
  productId: string,
  unitPrice: number,
) {
  const store = await getStore();
  // Verify club belongs to store
  const club = await prisma.club.findFirst({ where: { id: clubId, storeId: store.id } });
  if (!club) throw new Error("Club not found");
  await upsertClubProductPrice(clubId, productId, unitPrice);
  revalidatePath(`/clubs/${clubId}`);
}

export async function actionRegisterSale(data: {
  channel: "CLUB" | "MANUAL" | "EVENT" | "POPUP" | "WHOLESALE";
  clubId?: string;
  eventName?: string;
  customerName?: string;
  notes?: string;
  soldAt: string; // ISO date string
  items: SaleItem[];
}) {
  const store = await getStore();
  // Verify club belongs to store if provided
  if (data.clubId) {
    const club = await prisma.club.findFirst({ where: { id: data.clubId, storeId: store.id } });
    if (!club) throw new Error("Club not found");
  }
  await registerPhysicalSale(store.id, {
    ...data,
    soldAt: new Date(data.soldAt),
  });
  revalidatePath("/clubs");
  if (data.clubId) revalidatePath(`/clubs/${data.clubId}`);
  revalidatePath("/inventory");
}

export async function actionDeleteSale(saleId: string) {
  const store = await getStore();
  const sale = await prisma.manualSale.findFirst({
    where: { id: saleId, storeId: store.id },
    include: { items: true },
  });
  if (!sale) throw new Error("Sale not found");

  // Restore physical stock via each variant's recipe, then delete
  await prisma.$transaction(async (tx) => {
    for (const item of sale.items) {
      await restoreStock(tx, {
        storeId: store.id,
        variantId: item.variantId,
        saleQty: item.quantity,
        reference: saleId,
        note: "Venda eliminada",
      });
    }
    await tx.manualSale.delete({ where: { id: saleId } });
  });

  revalidatePath("/clubs");
  revalidatePath("/inventory");
}

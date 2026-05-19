"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
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

  // Restore stock
  await Promise.all(
    sale.items.map((item) =>
      Promise.all([
        prisma.productVariant.update({
          where: { id: item.variantId },
          data: { stockOnHand: { increment: item.quantity } },
        }),
        prisma.stockMovement.create({
          data: {
            storeId: store.id,
            variantId: item.variantId,
            type: "RETURN",
            quantity: item.quantity,
            reference: saleId,
            note: "Venda eliminada",
          },
        }),
      ]),
    ),
  );

  await prisma.manualSale.delete({ where: { id: saleId } });
  revalidatePath("/clubs");
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { consumeStock, restoreStock } from "@/lib/inventory/consume";
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

export async function actionAddClubMonth(data: {
  clubId: string;
  year: number;
  month: number;
  monthlyRevenue: number;
  items: { variantId: string; quantity: number; unitCost: number }[];
}) {
  const store = await getStore();
  const club = await prisma.club.findFirst({ where: { id: data.clubId, storeId: store.id } });
  if (!club) throw new Error("Club not found");

  const cogsTotal = data.items.reduce((s, i) => s + i.unitCost * i.quantity, 0);
  const grossProfit = data.monthlyRevenue - cogsTotal;
  const soldAt = new Date(Date.UTC(data.year, data.month - 1, 1));

  await prisma.$transaction(async (tx) => {
    const sale = await tx.manualSale.create({
      data: {
        storeId: store.id,
        channel: "CLUB",
        clubId: data.clubId,
        soldAt,
        subtotal: data.monthlyRevenue.toFixed(2),
        total: data.monthlyRevenue.toFixed(2),
        cogsTotal: cogsTotal.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        netProfit: grossProfit.toFixed(2),
        items: {
          create: data.items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            unitPrice: "0.00",
            unitCost: i.unitCost.toFixed(2),
            totalRevenue: "0.00",
            totalCost: (i.unitCost * i.quantity).toFixed(2),
          })),
        },
      },
    });
    for (const item of data.items) {
      await consumeStock(tx, {
        storeId: store.id,
        variantId: item.variantId,
        saleQty: item.quantity,
        type: "CLUB_SALE",
        reference: sale.id,
      });
    }
  });

  revalidatePath("/clubs");
  revalidatePath(`/clubs/${data.clubId}`);
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

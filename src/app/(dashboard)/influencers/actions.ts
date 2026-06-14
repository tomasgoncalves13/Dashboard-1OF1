"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { consumeStock } from "@/lib/inventory/consume";

async function getStore() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthenticated");
  const store = await prisma.store.findFirst({ where: { ownerId: user.id } });
  if (!store) throw new Error("Store not found");
  return store;
}

export async function addInfluencer(data: {
  name: string;
  handle?: string;
  platform?: string;
  instagram?: string;
  tiktok?: string;
  email?: string;
  country?: string;
  followers?: number;
  discountCode?: string;
  notes?: string;
}) {
  const store = await getStore();
  await prisma.influencer.create({
    data: { storeId: store.id, status: "PROSPECT", ...data },
  });
  revalidatePath("/influencers");
}

export async function updateInfluencerStatus(
  influencerId: string,
  status: string,
) {
  const store = await getStore();
  await prisma.influencer.update({
    where: { id: influencerId, storeId: store.id },
    data: { status: status as never },
  });
  revalidatePath("/influencers");
}

export async function updateInfluencerRevenue(influencerId: string, revenue: number) {
  const store = await getStore();
  await prisma.influencer.update({
    where: { id: influencerId, storeId: store.id },
    data: { attributedRevenue: revenue.toFixed(2) },
  });
  revalidatePath("/influencers");
}

export async function addShipment(data: {
  influencerId: string;
  items: { variantId: string; quantity: number; unitCost: number }[];
  shippingCost: number;
  carrier?: string;
  trackingNumber?: string;
  contentType?: string;
  notes?: string;
}) {
  const store = await getStore();
  await prisma.$transaction(async (tx) => {
    const shipment = await tx.influencerShipment.create({
      data: {
        storeId: store.id,
        influencerId: data.influencerId,
        shippingCost: data.shippingCost,
        carrier: data.carrier || null,
        trackingNumber: data.trackingNumber || null,
        contentType: (data.contentType as never) || null,
        notes: data.notes || null,
        status: "PREPARING",
        items: {
          create: data.items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            unitCost: item.unitCost,
          })),
        },
      },
    });
    for (const item of data.items) {
      await consumeStock(tx, {
        storeId: store.id,
        variantId: item.variantId,
        saleQty: item.quantity,
        type: "INFLUENCER_GIFT",
        reference: shipment.id,
      });
    }
  });
  revalidatePath("/influencers");
  revalidatePath("/inventory");
}

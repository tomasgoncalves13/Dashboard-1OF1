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

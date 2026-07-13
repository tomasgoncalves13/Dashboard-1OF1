"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { fullSync, incrementalSync, syncPayouts } from "@/lib/shopify/sync";
import { shopifyGraphQL } from "@/lib/shopify/client";
import { SHOP_QUERY } from "@/lib/shopify/queries";
import { recalculateAllOrderProfits } from "@/lib/profit/recalculate";

async function getOwnedStore() {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  const { ensureOwnedStore } = await import("@/lib/onboarding");
  return ensureOwnedStore(user.id);
}

export async function testShopifyConnection() {
  await getOwnedStore();
  const data = await shopifyGraphQL<{ shop: { name: string; myshopifyDomain: string; currencyCode: string } }>(SHOP_QUERY);
  return data.shop;
}

export async function runShopifyFullSync() {
  const store = await getOwnedStore();

  // Make sure the integration record exists & link the domain to the store.
  await prisma.store.update({
    where: { id: store.id },
    data: { shopifyDomain: process.env.SHOPIFY_STORE_DOMAIN },
  });
  await prisma.integration.upsert({
    where: { storeId_provider: { storeId: store.id, provider: "SHOPIFY" } },
    update: { status: "CONNECTED" },
    create: { storeId: store.id, provider: "SHOPIFY", status: "CONNECTED" },
  });

  const result = await fullSync(store.id);
  revalidatePath("/dashboard");
  revalidatePath("/orders");
  revalidatePath("/products");
  return result;
}

export async function runShopifyRecentSync() {
  const store = await getOwnedStore();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const orders = await incrementalSync(store.id, since);
  const payouts = await syncPayouts(store.id);
  revalidatePath("/dashboard");
  revalidatePath("/orders");
  revalidatePath("/finance");
  revalidatePath("/inventory");
  return { ...orders, ...payouts };
}

export async function runProfitRecalculate() {
  const store = await getOwnedStore();
  const result = await recalculateAllOrderProfits(store.id);
  revalidatePath("/dashboard");
  revalidatePath("/orders");
  return result;
}

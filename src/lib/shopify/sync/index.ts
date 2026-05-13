import { syncProducts } from "./products";
import { syncCustomers } from "./customers";
import { syncOrders } from "./orders";
import { prisma } from "@/lib/prisma";

/** Full sync: products → customers → orders (order matters: orders depend on the others). */
export async function fullSync(storeId: string) {
  const products = await syncProducts(storeId);
  const customers = await syncCustomers(storeId);
  const orders = await syncOrders(storeId);

  await prisma.integration.updateMany({
    where: { storeId, provider: "SHOPIFY" },
    data: { lastSyncedAt: new Date(), status: "CONNECTED" },
  });

  return { ...products, ...customers, ...orders };
}

/** Incremental: only orders updated since `since` (ISO date string). */
export async function incrementalSync(storeId: string, since: string) {
  const orders = await syncOrders(storeId, { query: `updated_at:>'${since}'` });
  await prisma.integration.updateMany({
    where: { storeId, provider: "SHOPIFY" },
    data: { lastSyncedAt: new Date() },
  });
  return orders;
}

export { syncProducts, syncCustomers, syncOrders };

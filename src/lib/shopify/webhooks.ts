import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";

// Routes a verified Shopify webhook to background work.
// Webhook topics this handles: orders/create, orders/updated, orders/cancelled,
// products/update, inventory_levels/update.

export async function handleShopifyWebhook(
  topic: string,
  shopDomain: string,
  body: Record<string, unknown>,
) {
  const store = await prisma.store.findFirst({
    where: { shopifyDomain: shopDomain },
    select: { id: true },
  });
  if (!store) return; // store not registered — ignore

  switch (topic) {
    case "orders/create":
    case "orders/updated":
    case "orders/cancelled": {
      const orderId = String(body.id ?? "");
      if (orderId) {
        await inngest.send({ name: "shopify/order.updated", data: { storeId: store.id, orderId } });
      }
      break;
    }
    case "products/update":
    case "products/create": {
      // Cheap path: trigger a small incremental product sync.
      await inngest.send({ name: "shopify/sync.full", data: { storeId: store.id } });
      break;
    }
    case "inventory_levels/update": {
      // Re-sync products to refresh stockOnHand.
      await inngest.send({ name: "shopify/sync.full", data: { storeId: store.id } });
      break;
    }
  }
}

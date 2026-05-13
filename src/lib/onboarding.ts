import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

/**
 * Ensure the signed-in user has a Store + Shopify Integration row.
 * Single-tenant for now: store domain + token come from env. Idempotent.
 */
export async function ensureOwnedStore(userId: string) {
  const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN ?? null;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ?? null;

  const ownedByMe = await prisma.store.findFirst({
    where: { ownerId: userId },
    include: { integrations: true },
  });
  if (ownedByMe) return ownedByMe;

  // Single-tenant: if the domain already belongs to a different (likely stale)
  // user record, reassign it to the current user instead of failing.
  if (shopifyDomain) {
    const byDomain = await prisma.store.findUnique({
      where: { shopifyDomain },
      include: { integrations: true },
    });
    if (byDomain) {
      return prisma.store.update({
        where: { id: byDomain.id },
        data: { ownerId: userId },
        include: { integrations: true },
      });
    }
  }

  return prisma.store.create({
    data: {
      ownerId: userId,
      name: "1OF1 Fútbol",
      shopifyDomain,
      currency: "EUR",
      integrations: accessToken
        ? {
            create: {
              provider: "SHOPIFY",
              status: "CONNECTED",
              accessToken: encrypt(accessToken),
              externalId: shopifyDomain,
            },
          }
        : undefined,
    },
    include: { integrations: true },
  });
}

import { prisma } from "@/lib/prisma";
import { shopifyGraphQL, gidToId } from "../client";
import { CUSTOMERS_QUERY } from "../queries";
import type { ShopifyCustomerNode } from "../types";

type Page = { customers: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; edges: { node: ShopifyCustomerNode }[] } };

export async function syncCustomers(storeId: string) {
  let cursor: string | null = null;
  let total = 0;

  do {
    const data: Page = await shopifyGraphQL<Page>(CUSTOMERS_QUERY, { cursor });

    for (const { node } of data.customers.edges) {
      const shopifyId = gidToId(node.id)!;
      await prisma.customer.upsert({
        where: { storeId_shopifyId: { storeId, shopifyId } },
        update: {
          email: node.email,
          firstName: node.firstName,
          lastName: node.lastName,
          phone: node.phone,
          country: node.defaultAddress?.country ?? null,
          city: node.defaultAddress?.city ?? null,
          marketingOptIn: node.emailMarketingConsent?.marketingState === "SUBSCRIBED",
          ordersCount: Number(node.numberOfOrders ?? 0),
          totalSpent: node.amountSpent.amount,
        },
        create: {
          storeId,
          shopifyId,
          email: node.email,
          firstName: node.firstName,
          lastName: node.lastName,
          phone: node.phone,
          country: node.defaultAddress?.country ?? null,
          city: node.defaultAddress?.city ?? null,
          marketingOptIn: node.emailMarketingConsent?.marketingState === "SUBSCRIBED",
          ordersCount: Number(node.numberOfOrders ?? 0),
          totalSpent: node.amountSpent.amount,
        },
      });
      total++;
    }

    cursor = data.customers.pageInfo.hasNextPage ? data.customers.pageInfo.endCursor : null;
  } while (cursor);

  return { customersSynced: total };
}

import { shopifyGraphQL, gidToId } from "../client";
import { ingestOrder } from "./orders";
import type { ShopifyOrderNode } from "../types";

const ORDER_BY_ID = /* GraphQL */ `
  query Order($id: ID!) {
    order(id: $id) {
      id
      name
      processedAt
      createdAt
      updatedAt
      cancelledAt
      displayFinancialStatus
      displayFulfillmentStatus
      currencyCode
      customer { id }
      shippingAddress { country city }
      subtotalPriceSet { shopMoney { amount } }
      totalDiscountsSet { shopMoney { amount } }
      totalShippingPriceSet { shopMoney { amount } }
      totalTaxSet { shopMoney { amount } }
      totalPriceSet { shopMoney { amount } }
      totalRefundedSet { shopMoney { amount } }
      lineItems(first: 100) {
        edges {
          node {
            id title sku quantity
            discountedUnitPriceSet { shopMoney { amount } }
            originalUnitPriceSet { shopMoney { amount } }
            variant { id inventoryItem { unitCost { amount } } }
          }
        }
      }
      transactions(first: 20) {
        id status kind
        amountSet { shopMoney { amount } }
        fees { amount { amount } }
      }
    }
  }
`;

export async function syncSingleOrder(storeId: string, shopifyOrderId: string) {
  const id = `gid://shopify/Order/${shopifyOrderId}`;
  const data = await shopifyGraphQL<{ order: ShopifyOrderNode | null }>(ORDER_BY_ID, { id });
  if (!data.order) return null;
  return ingestOrder(storeId, data.order);
}

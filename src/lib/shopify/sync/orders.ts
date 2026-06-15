import { prisma } from "@/lib/prisma";
import { shopifyGraphQL, gidToId } from "../client";
import { ORDERS_QUERY } from "../queries";
import type { ShopifyOrderNode } from "../types";
import { calculateOrderProfit } from "@/lib/profit/calculate";
import { getOrderOverheads, type OrderOverheads } from "@/lib/profit/order-costs";
import { consumeStock } from "@/lib/inventory/consume";

type Page = { orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; edges: { node: ShopifyOrderNode }[] } };

export type OrderSyncOptions = {
  /** Shopify query string. Use e.g. "updated_at:>2025-01-01" for incremental. */
  query?: string;
};

export async function syncOrders(storeId: string, opts: OrderSyncOptions = {}) {
  let cursor: string | null = null;
  let total = 0;
  // Fetch once per sync batch — all orders in a store share the same overhead config
  const overheads = await getOrderOverheads(storeId);

  do {
    const data: Page = await shopifyGraphQL<Page>(ORDERS_QUERY, {
      cursor,
      query: opts.query ?? null,
    });

    for (const { node } of data.orders.edges) {
      await ingestOrder(storeId, node, overheads);
      total++;
    }

    cursor = data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null;
  } while (cursor);

  return { ordersSynced: total };
}

/** Ingest a single order: upsert order + items, snapshot variant costs, compute profit. */
export async function ingestOrder(
  storeId: string,
  order: ShopifyOrderNode,
  overheads?: OrderOverheads,
) {
  const oh = overheads ?? (await getOrderOverheads(storeId));
  const shopifyOrderId = gidToId(order.id)!;

  // Resolve customer
  let customerId: string | null = null;
  if (order.customer?.id) {
    const cust = await prisma.customer.findUnique({
      where: { storeId_shopifyId: { storeId, shopifyId: gidToId(order.customer.id)! } },
      select: { id: true },
    });
    customerId = cust?.id ?? null;
  }

  // Build variant lookup for profit calc
  const variantGids = order.lineItems.edges.map((e) => e.node.variant?.id).filter(Boolean) as string[];
  const variantShopifyIds = variantGids.map((g) => gidToId(g)!).filter(Boolean);
  const dbVariants = await prisma.productVariant.findMany({
    where: { storeId, shopifyId: { in: variantShopifyIds } },
    select: { id: true, shopifyId: true, unitCost: true, packagingCost: true },
  });
  const variantByGid = new Map(
    dbVariants.map((v) => [
      `gid://shopify/ProductVariant/${v.shopifyId}`,
      { id: v.id, unitCost: v.unitCost, packagingCost: v.packagingCost },
    ]),
  );

  const profit = calculateOrderProfit(order, variantByGid, oh);

  // Upsert the order header
  const orderRow = await prisma.order.upsert({
    where: { storeId_shopifyId: { storeId, shopifyId: shopifyOrderId } },
    update: {
      orderNumber: order.name,
      customerId,
      channel: "SHOPIFY",
      currency: order.currencyCode,
      subtotal: order.subtotalPriceSet.shopMoney.amount,
      discountTotal: order.totalDiscountsSet.shopMoney.amount,
      shippingCharged: order.totalShippingPriceSet.shopMoney.amount,
      taxTotal: order.totalTaxSet.shopMoney.amount,
      total: order.totalPriceSet.shopMoney.amount,
      refundedTotal: order.totalRefundedSet.shopMoney.amount,
      financialStatus: order.displayFinancialStatus,
      fulfillmentStatus: order.displayFulfillmentStatus,
      paymentGateway: order.paymentGatewayNames?.[0] ?? null,
      cancelledAt: order.cancelledAt ? new Date(order.cancelledAt) : null,
      shippingCountry: order.shippingAddress?.countryCodeV2 ?? null,
      shippingCity: order.shippingAddress?.city ?? null,
      processedAt: new Date(order.processedAt),
      ...profit,
    },
    create: {
      storeId,
      shopifyId: shopifyOrderId,
      orderNumber: order.name,
      customerId,
      channel: "SHOPIFY",
      currency: order.currencyCode,
      subtotal: order.subtotalPriceSet.shopMoney.amount,
      discountTotal: order.totalDiscountsSet.shopMoney.amount,
      shippingCharged: order.totalShippingPriceSet.shopMoney.amount,
      taxTotal: order.totalTaxSet.shopMoney.amount,
      total: order.totalPriceSet.shopMoney.amount,
      refundedTotal: order.totalRefundedSet.shopMoney.amount,
      financialStatus: order.displayFinancialStatus,
      fulfillmentStatus: order.displayFulfillmentStatus,
      paymentGateway: order.paymentGatewayNames?.[0] ?? null,
      cancelledAt: order.cancelledAt ? new Date(order.cancelledAt) : null,
      shippingCountry: order.shippingAddress?.countryCodeV2 ?? null,
      shippingCity: order.shippingAddress?.city ?? null,
      processedAt: new Date(order.processedAt),
      ...profit,
    },
  });

  // Replace order items (cheap & correct — Shopify is the source of truth)
  await prisma.orderItem.deleteMany({ where: { orderId: orderRow.id } });
  await prisma.orderItem.createMany({
    data: order.lineItems.edges.map(({ node: li }) => {
      const variantGid = li.variant?.id ?? null;
      const dbV = variantGid ? variantByGid.get(variantGid) : null;
      const unitCost = dbV?.unitCost?.toString() ?? li.variant?.inventoryItem?.unitCost?.amount ?? "0";
      const unitPrice = li.discountedUnitPriceSet.shopMoney.amount;
      const original = Number(li.originalUnitPriceSet.shopMoney.amount);
      const discount = (original - Number(unitPrice)) * li.quantity;
      const totalRevenue = Number(unitPrice) * li.quantity;
      const totalCost = Number(unitCost) * li.quantity;
      return {
        orderId: orderRow.id,
        variantId: dbV?.id ?? null,
        shopifyLineId: gidToId(li.id)!,
        title: li.title,
        sku: li.sku,
        quantity: li.quantity,
        unitPrice,
        unitCost,
        discount: discount.toFixed(2),
        totalRevenue: totalRevenue.toFixed(2),
        totalCost: totalCost.toFixed(2),
      };
    }),
  });

  // Consume physical inventory — idempotent: skip if already consumed for this order
  const alreadyConsumed = await prisma.stockMovement.findFirst({
    where: { storeId, reference: shopifyOrderId, type: "SHOPIFY_SALE" },
  });

  if (!alreadyConsumed) {
    for (const { node: li } of order.lineItems.edges) {
      const variantGid = li.variant?.id ?? null;
      const dbV = variantGid ? variantByGid.get(variantGid) : null;
      if (!dbV?.id) continue;
      await prisma.$transaction((tx) =>
        consumeStock(tx, {
          storeId,
          variantId: dbV.id,
          saleQty: li.quantity,
          type: "SHOPIFY_SALE",
          reference: shopifyOrderId,
        }),
      );
    }
  }

  return orderRow;
}

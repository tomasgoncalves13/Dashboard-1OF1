import { prisma } from "@/lib/prisma";
import { shopifyGraphQL, gidToId } from "../client";
import { PRODUCTS_QUERY } from "../queries";
import type { ShopifyProductNode } from "../types";

type Page = { products: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; edges: { node: ShopifyProductNode }[] } };

export async function syncProducts(storeId: string) {
  let cursor: string | null = null;
  let total = 0;

  do {
    const data: Page = await shopifyGraphQL<Page>(PRODUCTS_QUERY, { cursor });

    for (const { node } of data.products.edges) {
      const productGid = node.id;
      const shopifyProductId = gidToId(productGid)!;

      const product = await prisma.product.upsert({
        where: { storeId_shopifyId: { storeId, shopifyId: shopifyProductId } },
        update: {
          title: node.title,
          handle: node.handle,
          description: node.description,
          vendor: node.vendor,
          productType: node.productType,
          tags: node.tags,
          status: node.status === "ARCHIVED" ? "ARCHIVED" : node.status === "DRAFT" ? "DRAFT" : "ACTIVE",
          imageUrl: node.featuredImage?.url ?? null,
        },
        create: {
          storeId,
          shopifyId: shopifyProductId,
          title: node.title,
          handle: node.handle,
          description: node.description,
          vendor: node.vendor,
          productType: node.productType,
          tags: node.tags,
          status: node.status === "ARCHIVED" ? "ARCHIVED" : node.status === "DRAFT" ? "DRAFT" : "ACTIVE",
          imageUrl: node.featuredImage?.url ?? null,
        },
      });

      for (const { node: v } of node.variants.edges) {
        const shopifyVariantId = gidToId(v.id)!;
        const unitCost = v.inventoryItem?.unitCost?.amount ?? null;

        await prisma.productVariant.upsert({
          where: { storeId_shopifyId: { storeId, shopifyId: shopifyVariantId } },
          update: {
            sku: v.sku?.trim() || null,
            barcode: v.barcode,
            title: v.title,
            price: v.price,
            compareAtPrice: v.compareAtPrice,
            stockOnHand: v.inventoryQuantity ?? 0,
            // NOTE: unitCost is deliberately NOT updated here — user may have
            // edited it locally. Initial backfill happens below for nulls only.
          },
          create: {
            storeId,
            productId: product.id,
            shopifyId: shopifyVariantId,
            sku: v.sku?.trim() || null,
            barcode: v.barcode,
            title: v.title,
            price: v.price,
            compareAtPrice: v.compareAtPrice,
            stockOnHand: v.inventoryQuantity ?? 0,
            unitCost: unitCost ?? undefined,
          },
        });

        // Initial-cost backfill: if our variant has no unitCost yet but
        // Shopify does, write it once. We never overwrite an existing value
        // because the user may have edited it locally.
        if (unitCost) {
          await prisma.productVariant.updateMany({
            where: { storeId, shopifyId: shopifyVariantId, unitCost: null },
            data: { unitCost },
          });
        }

        total++;
      }
    }

    cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (cursor);

  return { variantsSynced: total };
}

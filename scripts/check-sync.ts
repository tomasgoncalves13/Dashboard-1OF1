import { prisma } from "../src/lib/prisma";

async function main() {
  const [products, variants, customers, orders, items, integ] = await Promise.all([
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.customer.count(),
    prisma.order.count(),
    prisma.orderItem.count(),
    prisma.integration.findFirst({ where: { provider: "SHOPIFY" } }),
  ]);
  console.log({ products, variants, customers, orders, items, status: integ?.status, lastSyncedAt: integ?.lastSyncedAt });
  await prisma.$disconnect();
}
main();

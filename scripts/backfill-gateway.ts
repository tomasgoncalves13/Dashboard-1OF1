import { prisma } from "../src/lib/prisma";
import { shopifyGraphQL, gidToId } from "../src/lib/shopify/client";

const QUERY = /* GraphQL */ `
  query GW($cursor: String) {
    orders(first: 250, after: $cursor, sortKey: PROCESSED_AT) {
      pageInfo { hasNextPage endCursor }
      edges { node { id paymentGatewayNames } }
    }
  }
`;

async function main() {
  const store = await prisma.store.findFirst();
  if (!store) throw new Error("No store");

  let cursor: string | null = null;
  let updated = 0;
  do {
    const data: any = await shopifyGraphQL(QUERY, { cursor });
    for (const { node } of data.orders.edges) {
      const shopifyId = gidToId(node.id)!;
      const gw = node.paymentGatewayNames?.[0] ?? null;
      const r = await prisma.order.updateMany({
        where: { storeId: store.id, shopifyId },
        data: { paymentGateway: gw },
      });
      updated += r.count;
    }
    cursor = data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null;
  } while (cursor);

  console.log(`Updated ${updated} orders with paymentGateway`);

  const breakdown = await prisma.order.groupBy({
    by: ["paymentGateway", "financialStatus"],
    where: { storeId: store.id },
    _sum: { total: true },
    _count: { _all: true },
    orderBy: [{ paymentGateway: "asc" }, { financialStatus: "asc" }],
  });
  console.table(breakdown.map((b) => ({
    gateway: b.paymentGateway,
    status: b.financialStatus,
    orders: b._count._all,
    total: b._sum.total?.toString(),
  })));
  await prisma.$disconnect();
}
main();

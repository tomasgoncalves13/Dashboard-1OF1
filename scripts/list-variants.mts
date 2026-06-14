import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const variants = await p.productVariant.findMany({
  include: { product: { select: { title: true } } },
  orderBy: [{ product: { title: "asc" } }, { title: "asc" }],
});
variants.forEach((v) => console.log(`"${v.product.title}" | "${v.title}" | stock: ${v.stockOnHand}`));
await p.$disconnect();

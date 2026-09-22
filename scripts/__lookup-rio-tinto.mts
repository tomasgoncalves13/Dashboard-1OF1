import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const club = await p.club.findFirst({
  where: { name: { contains: "Rio Tinto", mode: "insensitive" } },
  include: { productPrices: { include: { product: true } } },
});
console.log("CLUB:", JSON.stringify(club, null, 2));

const variants = await p.productVariant.findMany({
  where: {
    product: {
      title: {
        in: undefined,
      },
    },
  },
  include: { product: { select: { title: true } } },
});

const products = await p.product.findMany({ select: { id: true, title: true } });
console.log("PRODUCTS:", JSON.stringify(products, null, 2));

await p.$disconnect();

import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const products = await p.product.findMany({
  where: { id: { in: ["cmp4mgda00089vum8hau5fwpq", "cmp4mfk9n000lvum8xafczvc4"] } },
});
console.log(JSON.stringify(products, null, 2));
await p.$disconnect();

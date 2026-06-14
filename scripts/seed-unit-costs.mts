import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const COSTS: { keyword: string; unitCost: number }[] = [
  { keyword: "built-in shin pad", unitCost: 2.84 },
  { keyword: "mini shin pad",   unitCost: 1.65 },
  { keyword: "airflow",         unitCost: 1.67 },
  { keyword: "grip sock",       unitCost: 0.88 },
  { keyword: "sock sleeve",     unitCost: 0.88 },
];

async function main() {
  const products = await prisma.product.findMany({
    include: { variants: { select: { id: true, title: true } } },
  });

  for (const { keyword, unitCost } of COSTS) {
    const matched = products.filter((p) =>
      p.title.toLowerCase().includes(keyword.toLowerCase())
    );

    if (matched.length === 0) {
      console.log(`⚠  Nenhum produto encontrado para "${keyword}"`);
      continue;
    }

    for (const product of matched) {
      const variantIds = product.variants.map((v) => v.id);
      await prisma.productVariant.updateMany({
        where: { id: { in: variantIds } },
        data: { unitCost: unitCost.toFixed(2) },
      });
      console.log(`✓  ${product.title} (${product.variants.length} variantes) → ${unitCost}€`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

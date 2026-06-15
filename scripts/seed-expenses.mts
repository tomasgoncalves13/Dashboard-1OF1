import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Despesas por mês — extraídas do ficheiro Excel
// Categoria: SOFTWARE=ferramentas, SUBSCRIPTIONS=subscrições recorrentes, SHOPIFY_APPS=apps Shopify, MISC=outros

type Despesa = { vendor: string; amount: number; category: string };

const NOV_DEZ_JAN: Despesa[] = [
  { vendor: "Verificado Insta", amount: 16.99, category: "SUBSCRIPTIONS" },
  { vendor: "Shopify",          amount: 32.00, category: "SUBSCRIPTIONS" },
  { vendor: "AfterSell",        amount: 29.95, category: "SHOPIFY_APPS" },
  { vendor: "HoodProTools",     amount:  7.65, category: "SOFTWARE" },
  { vendor: "Moloni",           amount: 13.40, category: "SOFTWARE" },
];

const FEV: Despesa[] = [
  { vendor: "Verificado Insta", amount: 16.99, category: "SUBSCRIPTIONS" },
  { vendor: "Shopify",          amount: 32.00, category: "SUBSCRIPTIONS" },
  { vendor: "HoodProTools",     amount:  7.65, category: "SOFTWARE" },
  { vendor: "Moloni",           amount: 13.40, category: "SOFTWARE" },
  { vendor: "Domínio",          amount:  3.06, category: "SUBSCRIPTIONS" },
  { vendor: "Web Email",        amount:  3.30, category: "SUBSCRIPTIONS" },
];

const MAR: Despesa[] = [
  ...FEV,
  { vendor: "Omnisend", amount: 14.90, category: "SOFTWARE" },
];

const ABR: Despesa[] = [
  ...MAR,
  { vendor: "Academia Ecommerce", amount: 358.75, category: "MISC" },
];

const MAI_EM_DIANTE: Despesa[] = [
  ...ABR,
  { vendor: "Claude", amount: 22.14, category: "SOFTWARE" },
];

// (mês 1-indexed, ano) → lista de despesas
const MESES: Array<{ year: number; month: number; despesas: Despesa[] }> = [
  { year: 2025, month: 11, despesas: NOV_DEZ_JAN },
  { year: 2025, month: 12, despesas: NOV_DEZ_JAN },
  { year: 2026, month:  1, despesas: NOV_DEZ_JAN },
  { year: 2026, month:  2, despesas: FEV },
  { year: 2026, month:  3, despesas: MAR },
  { year: 2026, month:  4, despesas: ABR },
  { year: 2026, month:  5, despesas: MAI_EM_DIANTE },
  { year: 2026, month:  6, despesas: MAI_EM_DIANTE },
  { year: 2026, month:  7, despesas: MAI_EM_DIANTE },
  { year: 2026, month:  8, despesas: MAI_EM_DIANTE },
  { year: 2026, month:  9, despesas: MAI_EM_DIANTE },
  { year: 2026, month: 10, despesas: MAI_EM_DIANTE },
  { year: 2026, month: 11, despesas: MAI_EM_DIANTE },
  { year: 2026, month: 12, despesas: MAI_EM_DIANTE },
  { year: 2027, month:  1, despesas: MAI_EM_DIANTE },
  { year: 2027, month:  2, despesas: MAI_EM_DIANTE },
  { year: 2027, month:  3, despesas: MAI_EM_DIANTE },
];

async function main() {
  const store = await prisma.store.findFirst();
  if (!store) throw new Error("Nenhuma store encontrada");

  let created = 0;
  let skipped = 0;

  for (const { year, month, despesas } of MESES) {
    const date = new Date(Date.UTC(year, month - 1, 1));

    for (const d of despesas) {
      // Idempotente: não duplica se já existir
      const existing = await prisma.expense.findFirst({
        where: {
          storeId: store.id,
          vendor: d.vendor,
          incurredOn: date,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.expense.create({
        data: {
          storeId: store.id,
          category: d.category as never,
          vendor: d.vendor,
          amount: d.amount.toFixed(2),
          incurredOn: date,
          recurring: true,
          recurringPeriod: "MONTHLY",
        },
      });
      created++;
    }

    console.log(`✓ ${year}/${String(month).padStart(2, "0")} — ${despesas.length} despesas`);
  }

  console.log(`\nConcluído: ${created} criadas, ${skipped} já existiam`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

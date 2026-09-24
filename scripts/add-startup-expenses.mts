// Despesas pontuais do arranque (folha "Cash Flow 1OF1" → "Dinheiro Gasto") que não estavam na BD.
// Ficam de fora: as compras de stock (já estão em /encomendas), o Meta Ads (já está em AdMetric)
// e a Moloni anual (já está como despesa mensal). Idempotente: salta as que já existem.
// Uso: npx tsx --env-file=.env scripts/add-startup-expenses.mts
import { PrismaClient, type ExpenseCategory } from "@prisma/client";

const prisma = new PrismaClient();

const rows: [string, string, string, number, ExpenseCategory][] = [
  ["2024-12-08", "Temu", "Amostras: meias, caneleiras, snood, gorro, manta, almofada, autocolantes", 70, "MISC"],
  ["2025-01-13", "INPI", "Patente da marca 1OF1 Futbol", 182.46, "MISC"],
  ["2025-02-21", "Temu", "Equipamentos, autocolantes e cartões (1000 cartões, 384 autocolantes)", 62, "MISC"],
  ["2025-03-09", "Temu", "Equipamentos para shooting (calções, t-shirts, luvas, casaco)", 55, "MISC"],
  ["2025-04-05", "Ab Brindes", "Estampagem equipamentos 1OF1", 50, "MISC"],
  ["2025-04-08", "Atlântico + Pai David", "Shooting (alugar campo + jantar)", 55, "MISC"],
  ["2025-04-08", "SportZone", "Bola de futebol e caneleiras velhas", 40, "MISC"],
  ["2025-04-14", "Canva", "Canva (4 meses até abril)", 48, "SOFTWARE"],
  ["2025-04-15", "ChatGPT", "ChatGPT Plus", 23, "SOFTWARE"],
  ["2025-04-16", "Amazon", "Impressora de etiquetas e etiquetas", 122.67, "PACKAGING"],
];

const store = await prisma.store.findFirstOrThrow();
let added = 0;
for (const [date, vendor, description, amount, category] of rows) {
  const incurredOn = new Date(date);
  const exists = await prisma.expense.findFirst({ where: { storeId: store.id, incurredOn, vendor, amount } });
  if (exists) continue;
  await prisma.expense.create({ data: { storeId: store.id, incurredOn, vendor, description, amount, category, recurring: false } });
  added++;
}
console.log(`adicionadas ${added} de ${rows.length} despesas`);
await prisma.$disconnect();

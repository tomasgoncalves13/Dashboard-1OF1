/**
 * 26 Set 2026: novos tamanhos físicos de Caneleiras Embutidas de criança (manga de criança):
 * BUILTIN-KM (12x6, Criança Médio / MIDI) e BUILTIN-KL (14x6, Criança Grande / MAXI).
 * Cria os itens com stock 0. Não mexe no BOM: até chegarem, o Criança Médio continua a sair do M.
 * Idempotente.
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const store = await p.store.findFirst();
if (!store) throw new Error("No store");
for (const [code, name] of [["BUILTIN-KM", "Built-In Shin Pad M Criança (12x6)"], ["BUILTIN-KL", "Built-In Shin Pad L Criança (14x6)"]]) {
  const found = await p.inventoryItem.findFirst({ where: { storeId: store.id, code } });
  if (found) { console.log(`= ${code} já existe`); continue; }
  await p.inventoryItem.create({ data: { storeId: store.id, code, name, family: "Built-In Shin Pads", unitCost: "2.84", stockOnHand: 0 } });
  console.log(`✓ ${code} criado`);
}
await p.$disconnect();

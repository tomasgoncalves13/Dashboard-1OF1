import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { importEupagoPayouts } from "../src/lib/eupago/import-payouts";

async function main() {
  const s = await prisma.store.findFirst();
  if (!s) { console.log("no store"); return; }
  const raw = readFileSync("C:/Users/Tom/Downloads/Pagamentos Emitidos.csv", "utf8");
  const r = await importEupagoPayouts(s.id, raw);
  console.log("Import:", JSON.stringify(r));
  const agg = await prisma.eupagoPayout.aggregate({
    _sum: { netAmount: true, grossAmount: true, commission: true, iva: true },
    _count: { _all: true },
    _min: { paymentDate: true },
    _max: { paymentDate: true },
  });
  console.log("Count:", agg._count._all);
  console.log("Net:", agg._sum.netAmount?.toString());
  console.log("Gross:", agg._sum.grossAmount?.toString());
  console.log("Fees:", (Number(agg._sum.commission ?? 0) + Number(agg._sum.iva ?? 0)).toFixed(2));
  console.log(
    "Range:",
    agg._min.paymentDate?.toISOString().slice(0, 10),
    "to",
    agg._max.paymentDate?.toISOString().slice(0, 10),
  );
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

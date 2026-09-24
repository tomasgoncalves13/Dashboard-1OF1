// Guarda o gasto Meta por campanha/dia na base de dados.
// Uso: npx tsx --env-file=.env scripts/sync-meta-ads.mts [desde=2025-07-01] [até=hoje]
const pm: any = await import("../src/lib/prisma");
const sm: any = await import("../src/lib/meta/sync-ads");
const prisma = pm.prisma ?? pm.default.prisma;
const sync = sm.syncMetaAdSpend ?? sm.default.syncMetaAdSpend;

const since = process.argv[2] ?? "2025-07-01";
const until = process.argv[3] ?? new Date().toISOString().slice(0, 10);
const store = await prisma.store.findFirstOrThrow();
console.log(await sync(store.id, since, until));

const rows = await prisma.$queryRaw`
  SELECT to_char(m.date, 'YYYY-MM') AS month, SUM(m.spend)::float AS spend
  FROM ad_metrics m JOIN ad_campaigns c ON c.id = m."campaignId"
  WHERE c."storeId" = ${store.id} AND c.provider = 'META'
  GROUP BY 1 ORDER BY 1`;
console.table(rows);
await prisma.$disconnect();

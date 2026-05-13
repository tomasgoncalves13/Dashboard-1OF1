import { prisma } from "@/lib/prisma";

const PAID_STATUSES = ["PAID"];

export type KpiSet = {
  revenue: number;
  netProfit: number;
  cogs: number;
  fees: number;
  adSpend: number;
  ordersCount: number;
  aov: number;
  margin: number | null;
};

export async function getKpis(
  storeId: string,
  from: Date,
  to: Date,
  opts: { paidOnly: boolean },
): Promise<KpiSet> {
  const where = {
    storeId,
    processedAt: { gte: from, lte: to },
    ...(opts.paidOnly ? { financialStatus: { in: PAID_STATUSES } } : {}),
  };

  const [agg, ordersCount] = await Promise.all([
    prisma.order.aggregate({
      where,
      _sum: {
        total: true,
        cogsTotal: true,
        paymentFees: true,
        netProfit: true,
        attributedAdSpend: true,
      },
    }),
    prisma.order.count({ where }),
  ]);

  const revenue = Number(agg._sum.total ?? 0);
  const netProfit = Number(agg._sum.netProfit ?? 0);
  const cogs = Number(agg._sum.cogsTotal ?? 0);
  const fees = Number(agg._sum.paymentFees ?? 0);
  const adSpend = Number(agg._sum.attributedAdSpend ?? 0);

  return {
    revenue,
    netProfit,
    cogs,
    fees,
    adSpend,
    ordersCount,
    aov: ordersCount > 0 ? revenue / ordersCount : 0,
    margin: revenue > 0 ? (netProfit / revenue) * 100 : null,
  };
}

export async function getDailyRevenue(
  storeId: string,
  from: Date,
  to: Date,
  opts: { paidOnly: boolean },
) {
  const statusFilter = opts.paidOnly
    ? prisma.$queryRawUnsafe<{ day: Date; revenue: number; net_profit: number }[]>(
        `select date_trunc('day', "processedAt") as day,
                sum("total")::float as revenue,
                sum("netProfit")::float as net_profit
         from "orders"
         where "storeId" = $1 and "processedAt" >= $2 and "processedAt" <= $3
           and "financialStatus" = ANY($4)
         group by 1 order by 1 asc`,
        storeId, from, to, PAID_STATUSES,
      )
    : prisma.$queryRawUnsafe<{ day: Date; revenue: number; net_profit: number }[]>(
        `select date_trunc('day', "processedAt") as day,
                sum("total")::float as revenue,
                sum("netProfit")::float as net_profit
         from "orders"
         where "storeId" = $1 and "processedAt" >= $2 and "processedAt" <= $3
         group by 1 order by 1 asc`,
        storeId, from, to,
      );
  return statusFilter;
}

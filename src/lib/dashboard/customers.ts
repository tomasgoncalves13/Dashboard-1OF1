import { prisma } from "@/lib/prisma";

export type CustomerMetrics = {
  /** Clientes cuja 1ª encomenda paga caiu no intervalo. */
  newCustomers: number;
  /** Encomendas pagas no intervalo de clientes que já tinham comprado antes. */
  returningOrders: number;
  /** LTV (all-time): receita média por cliente pagante. */
  ltvRevenue: number;
  /** LTV (all-time): net profit médio por cliente (depois de COGS, envio, embalagem e taxas — antes de ads). */
  ltvProfit: number;
  /** % de clientes (all-time) com 2+ encomendas pagas. */
  repeatRate: number;
};

// Cliente "novo" = a encomenda é a 1ª encomenda PAGA desse cliente (histórico
// completo, não só o intervalo). Encomendas sem customerId (checkout de
// convidado / cliente apagado) não dá para ligar a ninguém — contam como
// cliente novo com 1 encomenda.
export async function getCustomerMetrics(storeId: string, from: Date, to: Date): Promise<CustomerMetrics> {
  const orders = await prisma.order.findMany({
    where: { storeId, financialStatus: "PAID" },
    select: { customerId: true, processedAt: true, total: true, netProfit: true },
    orderBy: { processedAt: "asc" },
  });

  const seen = new Set<string>();
  const byCustomer = new Map<string, { revenue: number; profit: number; count: number }>();
  let newCustomers = 0;
  let returningOrders = 0;

  orders.forEach((o, i) => {
    const key = o.customerId ?? `guest:${i}`;
    const isNew = !seen.has(key);
    seen.add(key);

    const inRange = o.processedAt >= from && o.processedAt <= to;
    if (inRange) {
      if (isNew) newCustomers++;
      else returningOrders++;
    }

    const c = byCustomer.get(key) ?? { revenue: 0, profit: 0, count: 0 };
    c.revenue += Number(o.total);
    c.profit += Number(o.netProfit);
    c.count += 1;
    byCustomer.set(key, c);
  });

  const customers = [...byCustomer.values()];
  const n = customers.length;
  return {
    newCustomers,
    returningOrders,
    ltvRevenue: n > 0 ? customers.reduce((s, c) => s + c.revenue, 0) / n : 0,
    ltvProfit: n > 0 ? customers.reduce((s, c) => s + c.profit, 0) / n : 0,
    repeatRate: n > 0 ? (customers.filter((c) => c.count > 1).length / n) * 100 : 0,
  };
}

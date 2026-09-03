import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { getOrderOverheads } from "@/lib/profit/order-costs";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CostTable } from "./cost-table";
import { OverheadForm } from "./overhead-form";

export default async function CostsPage() {
  const user = await getSessionUser();
  const store = user ? await prisma.store.findFirst({ where: { ownerId: user.id } }) : null;
  if (!store) return null;

  const [products, overheads, costSums] = await Promise.all([
    prisma.product.findMany({
      where: { storeId: store.id, status: "ACTIVE" },
      include: {
        variants: {
          orderBy: { title: "asc" },
          select: { id: true, title: true, sku: true, unitCost: true, price: true },
        },
      },
      orderBy: { title: "asc" },
    }),
    getOrderOverheads(store.id),
    prisma.order.aggregate({
      where: { storeId: store.id },
      _sum: { shippingCost: true, cogsTotal: true, packagingCost: true },
    }),
  ]);

  const totalOverhead = overheads.totalPerOrder;
  const currency = store.currency;
  const totalShippingCost = Number(costSums._sum.shippingCost ?? 0);
  const totalCogs =
    Number(costSums._sum.cogsTotal ?? 0) + Number(costSums._sum.packagingCost ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cost Management</h1>
        <p className="text-sm text-muted-foreground">
          Custos de produto por variante + overhead fixo por encomenda online.
          Alterações disparam recálculo retroativo de todas as encomendas.
        </p>
      </div>

      {/* Cost totals */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Custo total de envios</CardTitle>
            <CardDescription>Soma do custo de envio de todas as encomendas.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatMoney(totalShippingCost, currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Custo total de produtos (COGS)</CardTitle>
            <CardDescription>Custo de produto + embalagem (bubble mailer, cartão, autocolante, prenda) de todas as encomendas.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatMoney(totalCogs, currency)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-order overheads */}
      <Card>
        <CardHeader>
          <CardTitle>Overhead por encomenda online</CardTitle>
          <CardDescription>
            Custos fixos incluídos em cada encomenda Shopify.
            Total atual: <strong>{formatMoney(totalOverhead, currency)}</strong> por encomenda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OverheadForm overheads={overheads} />
        </CardContent>
      </Card>

      {/* Product cost catalog */}
      <Card>
        <CardHeader>
          <CardTitle>Catálogo de custos — produto por variante</CardTitle>
          <CardDescription>
            Custo de produto (unitCost). Clica no valor para editar.
            O preço de venda vem diretamente do Shopify — não é guardado aqui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CostTable products={products} currency={currency} />
        </CardContent>
      </Card>
    </div>
  );
}

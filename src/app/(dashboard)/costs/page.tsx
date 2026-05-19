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

  const [products, overheads] = await Promise.all([
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
  ]);

  const totalOverhead = overheads.totalPerOrder;
  const currency = store.currency;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cost Management</h1>
        <p className="text-sm text-muted-foreground">
          Custos de produto por variante + overhead fixo por encomenda online.
          Alterações disparam recálculo retroativo de todas as encomendas.
        </p>
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

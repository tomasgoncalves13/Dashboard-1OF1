import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import { EupagoUpload } from "./eupago-upload";

export default async function ImportsPage() {
  const user = await getSessionUser();
  const store = user ? await prisma.store.findFirst({ where: { ownerId: user.id } }) : null;

  const [agg, recent] = store
    ? await Promise.all([
        prisma.eupagoPayout.aggregate({
          where: { storeId: store.id },
          _sum: { netAmount: true, grossAmount: true, commission: true, iva: true },
          _count: { _all: true },
        }),
        prisma.eupagoPayout.findMany({
          where: { storeId: store.id },
          orderBy: { paymentDate: "desc" },
          take: 10,
        }),
      ])
    : [null, [] as Array<Awaited<ReturnType<typeof prisma.eupagoPayout.findFirst>>>];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Imports</h1>
        <p className="text-sm text-muted-foreground">
          Upload de ficheiros históricos. Deduplicação automática.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Eupago</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <EupagoUpload />

          {agg && agg._count._all > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Stat label="Payouts" value={String(agg._count._all)} />
                <Stat label="Bruto total" value={formatMoney(Number(agg._sum.grossAmount ?? 0), "EUR")} />
                <Stat label="Fees total" value={formatMoney(Number(agg._sum.commission ?? 0) + Number(agg._sum.iva ?? 0), "EUR")} />
                <Stat label="Net para conta" value={formatMoney(Number(agg._sum.netAmount ?? 0), "EUR")} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left font-medium py-2">Data pagamento</th>
                      <th className="text-left font-medium py-2">Período transações</th>
                      <th className="text-right font-medium py-2">Bruto</th>
                      <th className="text-right font-medium py-2">Fees</th>
                      <th className="text-right font-medium py-2">Net</th>
                      <th className="text-left font-medium py-2 hidden md:table-cell">SEPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((p) => p && (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2">{p.paymentDate.toISOString().slice(0, 10)}</td>
                        <td className="py-2 text-muted-foreground text-xs">
                          {p.periodStart ? p.periodStart.toISOString().slice(0, 10) : "—"}
                          {" → "}
                          {p.periodEnd ? p.periodEnd.toISOString().slice(0, 10) : "—"}
                        </td>
                        <td className="py-2 text-right tabular-nums">{formatMoney(Number(p.grossAmount), "EUR")}</td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          {formatMoney(Number(p.commission) + Number(p.iva), "EUR")}
                        </td>
                        <td className="py-2 text-right tabular-nums font-medium">{formatMoney(Number(p.netAmount), "EUR")}</td>
                        <td className="py-2 hidden md:table-cell text-xs text-muted-foreground">{p.fileRef}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">A mostrar os 10 mais recentes.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}

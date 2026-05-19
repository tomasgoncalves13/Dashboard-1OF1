"use client";

import { useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { deleteExpense } from "./actions";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { Prisma } from "@prisma/client";

type Expense = {
  id: string;
  category: string;
  vendor: string | null;
  description: string | null;
  amount: Prisma.Decimal;
  incurredOn: Date;
  recurring: boolean;
  recurringPeriod: string | null;
};

type Props = {
  expenses: Expense[];
  currency: string;
  categoryLabels: Record<string, string>;
};

export function ExpenseList({ expenses, currency, categoryLabels }: Props) {
  return (
    <Card>
      <CardHeader><CardTitle>Todas as despesas</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem despesas no período.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="text-left font-medium py-2">Data</th>
                <th className="text-left font-medium py-2">Categoria</th>
                <th className="text-left font-medium py-2">Fornecedor</th>
                <th className="text-left font-medium py-2">Descrição</th>
                <th className="text-right font-medium py-2">Valor</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <ExpenseRow key={e.id} expense={e} currency={currency} categoryLabels={categoryLabels} />
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function ExpenseRow({ expense: e, currency, categoryLabels }: { expense: Expense; currency: string; categoryLabels: Record<string, string> }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteExpense(e.id);
        toast.success("Despesa eliminada.");
      } catch {
        toast.error("Erro ao eliminar.");
      }
    });
  }

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 tabular-nums text-muted-foreground text-xs">
        {e.incurredOn.toLocaleDateString("pt-PT")}
        {e.recurring && (
          <span className="ml-1 text-[10px] bg-muted px-1 rounded">{e.recurringPeriod?.toLowerCase()}</span>
        )}
      </td>
      <td className="py-2">{categoryLabels[e.category] ?? e.category}</td>
      <td className="py-2 text-muted-foreground">{e.vendor ?? "—"}</td>
      <td className="py-2 text-muted-foreground text-xs">{e.description ?? "—"}</td>
      <td className="py-2 text-right tabular-nums font-medium">{formatMoney(Number(e.amount), currency)}</td>
      <td className="py-2 text-right">
        <Button
          variant="ghost" size="sm" className="h-7 w-7 p-0"
          onClick={handleDelete} disabled={pending}
        >
          <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
        </Button>
      </td>
    </tr>
  );
}

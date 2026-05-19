"use client";

import { useState, useTransition } from "react";
import { updateVariantCost } from "./actions";
import { formatMoney } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Prisma } from "@prisma/client";

type Variant = {
  id: string;
  title: string;
  sku: string | null;
  unitCost: Prisma.Decimal | null;
  price: Prisma.Decimal;
};

type Product = {
  id: string;
  title: string;
  imageUrl: string | null;
  variants: Variant[];
};

type Props = { products: Product[]; currency: string };

export function CostTable({ products, currency }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground border-b">
          <tr>
            <th className="text-left font-medium py-2 pr-4">Produto / Variante</th>
            <th className="text-left font-medium py-2 pr-4">SKU</th>
            <th className="text-right font-medium py-2 pr-4">Preço venda</th>
            <th className="text-right font-medium py-2 pr-4">Custo produto</th>
            <th className="text-right font-medium py-2">Margem bruta</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <>
              <tr key={`h-${p.id}`} className="border-b bg-muted/20">
                <td colSpan={5} className="py-2 px-1 font-semibold text-foreground">
                  {p.title}
                </td>
              </tr>
              {p.variants.map((v) => (
                <VariantRow key={v.id} variant={v} currency={currency} />
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VariantRow({ variant: v, currency }: { variant: Variant; currency: string }) {
  const [editing, setEditing] = useState(false);
  const [cost, setCost] = useState(v.unitCost ? Number(v.unitCost).toFixed(2) : "");
  const [pending, startTransition] = useTransition();

  const unitCost = Number(cost || 0);
  const price = Number(v.price);
  const margin = price > 0 && unitCost > 0 ? ((price - unitCost) / price) * 100 : null;

  function save() {
    startTransition(async () => {
      try {
        await updateVariantCost(v.id, unitCost);
        setEditing(false);
        toast.success("Custo atualizado.");
      } catch {
        toast.error("Erro ao guardar custo.");
      }
    });
  }

  return (
    <tr className="border-b last:border-0 hover:bg-muted/10">
      <td className="py-2 pr-4 pl-4 text-muted-foreground">{v.title}</td>
      <td className="py-2 pr-4 text-muted-foreground tabular-nums text-xs">{v.sku ?? "—"}</td>
      <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(price, currency)}</td>
      <td className="py-2 pr-4 text-right">
        {editing ? (
          <div className="flex items-center justify-end gap-1">
            <span className="text-muted-foreground text-xs">€</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className="w-24 h-7 text-sm tabular-nums"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
            />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={save} disabled={pending}>
              {pending ? "…" : "✓"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(false)}>
              ✕
            </Button>
          </div>
        ) : (
          <button
            className="tabular-nums hover:underline text-right w-full cursor-pointer"
            onClick={() => setEditing(true)}
            title="Clica para editar"
          >
            {unitCost > 0 ? formatMoney(unitCost, currency) : (
              <span className="text-muted-foreground italic text-xs">— definir</span>
            )}
          </button>
        )}
      </td>
      <td className="py-2 text-right tabular-nums">
        {margin !== null ? (
          <span className={margin < 20 ? "text-destructive" : margin > 50 ? "text-emerald-600" : ""}>
            {margin.toFixed(1)}%
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

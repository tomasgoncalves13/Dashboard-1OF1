"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { actionUpsertClubPrice } from "../actions";
import { formatMoney } from "@/lib/utils";
import { toast } from "sonner";

type Product = { id: string; title: string; imageUrl: string | null };
type ExistingPrice = { productId: string; unitPrice: { toString(): string } };
type Props = { clubId: string; products: Product[]; existingPrices: ExistingPrice[]; currency: string };

export function ClubPricingTable({ clubId, products, existingPrices, currency }: Props) {
  const priceMap = Object.fromEntries(
    existingPrices.map((p) => [p.productId, Number(p.unitPrice).toFixed(2)]),
  );

  return (
    <div className="space-y-1">
      {products.map((p) => (
        <PriceRow
          key={p.id}
          clubId={clubId}
          product={p}
          existing={priceMap[p.id]}
          currency={currency}
        />
      ))}
    </div>
  );
}

function PriceRow({
  clubId,
  product,
  existing,
  currency,
}: {
  clubId: string;
  product: Product;
  existing?: string;
  currency: string;
}) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(existing ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    const v = Number(price);
    if (v <= 0) return;
    startTransition(async () => {
      try {
        await actionUpsertClubPrice(clubId, product.id, v);
        setEditing(false);
        toast.success("Preço atualizado.");
      } catch {
        toast.error("Erro ao guardar preço.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between border rounded px-3 py-2 text-sm">
      <span className="font-medium">{product.title}</span>
      {editing ? (
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-xs">€</span>
          <Input
            type="number" min="0" step="0.01" value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-20 h-7 text-sm tabular-nums"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <Button size="sm" className="h-7 px-2 text-xs" onClick={save} disabled={pending}>✓</Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(false)}>✕</Button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="tabular-nums hover:underline">
          {price ? formatMoney(Number(price), currency) : (
            <span className="text-muted-foreground text-xs italic">— definir</span>
          )}
        </button>
      )}
    </div>
  );
}

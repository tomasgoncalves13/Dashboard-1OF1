"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrderOverheads } from "./actions";
import type { OrderOverheads } from "@/lib/profit/order-costs";
import { toast } from "sonner";

type Props = { overheads: OrderOverheads };

export function OverheadForm({ overheads }: Props) {
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({
    freeGiftCost: overheads.freeGiftCost.toFixed(2),
    bubbleMailerCost: overheads.bubbleMailerCost.toFixed(2),
    cardCost: overheads.cardCost.toFixed(2),
    stickerCost: overheads.stickerCost.toFixed(2),
    shippingDomestic: overheads.shippingDomestic.toFixed(2),
    shippingEU: overheads.shippingEU.toFixed(2),
  });

  const packagingFields = [
    { key: "freeGiftCost" as const, label: "Grip Socks (oferta)", hint: "1 par por encomenda, sempre" },
    { key: "bubbleMailerCost" as const, label: "Bubble Mailer" },
    { key: "cardCost" as const, label: "Cartão" },
    { key: "stickerCost" as const, label: "Autocolante" },
  ];

  const shippingFields = [
    { key: "shippingDomestic" as const, label: "Envio PT", hint: "Portugal continental" },
    { key: "shippingEU" as const, label: "Envio EU", hint: "Europa / internacional" },
  ];

  const packagingTotal = packagingFields.reduce((s, f) => s + Number(values[f.key] || 0), 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateOrderOverheads({
          freeGiftCost: Number(values.freeGiftCost),
          bubbleMailerCost: Number(values.bubbleMailerCost),
          cardCost: Number(values.cardCost),
          stickerCost: Number(values.stickerCost),
          shippingDomestic: Number(values.shippingDomestic),
          shippingEU: Number(values.shippingEU),
        });
        toast.success("Overhead atualizado. Recálculo retroativo iniciado em background.");
      } catch {
        toast.error("Erro ao guardar overhead.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase mb-3">Embalagem</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {packagingFields.map(({ key, label, hint }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">€</span>
                <Input
                  id={key}
                  type="number"
                  step="0.01"
                  min="0"
                  value={values[key]}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                  className="w-28 tabular-nums"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase mb-3">Envio</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {shippingFields.map(({ key, label, hint }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">€</span>
                <Input
                  id={key}
                  type="number"
                  step="0.01"
                  min="0"
                  value={values[key]}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                  className="w-28 tabular-nums"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t">
        <p className="text-sm text-muted-foreground">
          Total embalagem por encomenda: <span className="font-semibold text-foreground">€{packagingTotal.toFixed(2)}</span>
        </p>
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "A guardar…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

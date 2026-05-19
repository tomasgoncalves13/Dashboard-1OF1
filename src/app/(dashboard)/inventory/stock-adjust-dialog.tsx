"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adjustStock } from "./actions";
import { toast } from "sonner";
import { SlidersHorizontal } from "lucide-react";
import type { Prisma } from "@prisma/client";

type Variant = { id: string; title: string; stockOnHand: number };
type Product = { id: string; title: string; variants: Variant[] };
type Props = { products: Product[]; storeId: string };

export function StockAdjustDialog({ products }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [variantId, setVariantId] = useState("");
  const [type, setType] = useState<"ADJUSTMENT" | "PURCHASE" | "LOSS">("ADJUSTMENT");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const selectedVariant = products.flatMap((p) => p.variants).find((v) => v.id === variantId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!variantId || !quantity) return;
    const qty = Number(quantity);
    startTransition(async () => {
      try {
        await adjustStock({ variantId, type, quantity: qty, note: note || undefined });
        toast.success("Stock ajustado.");
        setOpen(false);
        setVariantId(""); setQuantity(""); setNote("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao ajustar stock.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <SlidersHorizontal className="size-4" /> Ajustar stock
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Ajuste manual de stock</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Variante</Label>
            <Select value={variantId} onValueChange={setVariantId}>
              <SelectTrigger><SelectValue placeholder="Seleciona variante…" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => p.variants.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {p.title} — {v.title} (stock: {v.stockOnHand})
                  </SelectItem>
                )))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                  <SelectItem value="PURCHASE">Compra / recepção</SelectItem>
                  <SelectItem value="LOSS">Perda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade (+ entrada, − saída)</Label>
              <Input
                type="number" value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Ex: +50 ou -5"
              />
            </div>
          </div>
          {selectedVariant && (
            <p className="text-xs text-muted-foreground">
              Stock actual: <strong>{selectedVariant.stockOnHand}</strong>
              {quantity && !isNaN(Number(quantity)) && (
                <> → <strong>{selectedVariant.stockOnHand + Number(quantity)}</strong></>
              )}
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Nota (opcional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo do ajuste…" />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "A guardar…" : "Confirmar ajuste"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

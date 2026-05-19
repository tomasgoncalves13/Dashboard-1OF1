"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { actionRegisterSale } from "./actions";
import { toast } from "sonner";
import { ShoppingBag, Plus, Trash2 } from "lucide-react";
import type { Prisma } from "@prisma/client";

type Club = { id: string; name: string };
type Variant = { id: string; title: string; unitCost: Prisma.Decimal | null; stockOnHand: number };
type Product = { id: string; title: string; variants: Variant[] };

type Props = { clubs: Club[]; products: Product[]; currency: string };

type LineItem = {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
};

export function SaleRegisterDialog({ clubs, products, currency }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [channel, setChannel] = useState<"CLUB" | "MANUAL" | "EVENT">("MANUAL");
  const [clubId, setClubId] = useState("");
  const [soldAt, setSoldAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);

  // For adding a new line
  const [selVariantId, setSelVariantId] = useState("");
  const [selQty, setSelQty] = useState(1);
  const [selPrice, setSelPrice] = useState("");

  const selectedVariant = products.flatMap((p) => p.variants).find((v) => v.id === selVariantId);
  const selectedProduct = products.find((p) => p.variants.some((v) => v.id === selVariantId));

  function addItem() {
    if (!selVariantId || !selectedVariant || !selectedProduct) return;
    const price = Number(selPrice);
    if (price <= 0) return;
    setItems((prev) => [
      ...prev,
      {
        variantId: selVariantId,
        productTitle: selectedProduct.title,
        variantTitle: selectedVariant.title,
        quantity: selQty,
        unitPrice: price,
        unitCost: Number(selectedVariant.unitCost ?? 0),
      },
    ]);
    setSelVariantId("");
    setSelQty(1);
    setSelPrice("");
  }

  const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const totalCogs = items.reduce((s, i) => s + i.unitCost * i.quantity, 0);
  const grossProfit = total - totalCogs;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) { toast.error("Adiciona pelo menos 1 item."); return; }
    if (channel === "CLUB" && !clubId) { toast.error("Seleciona um clube."); return; }
    startTransition(async () => {
      try {
        await actionRegisterSale({
          channel,
          clubId: channel === "CLUB" ? clubId : undefined,
          notes,
          soldAt,
          items: items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            unitCost: i.unitCost,
          })),
        });
        toast.success("Venda registada.");
        setOpen(false);
        setItems([]);
        setNotes("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao registar venda.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <ShoppingBag className="size-4" /> Registar venda
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registar venda física</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Venda própria</SelectItem>
                  <SelectItem value="CLUB">Clube</SelectItem>
                  <SelectItem value="EVENT">Evento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {channel === "CLUB" && (
              <div className="space-y-1.5">
                <Label>Clube</Label>
                <Select value={clubId} onValueChange={setClubId}>
                  <SelectTrigger><SelectValue placeholder="Seleciona…" /></SelectTrigger>
                  <SelectContent>
                    {clubs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={soldAt} onChange={(e) => setSoldAt(e.target.value)} required />
            </div>
          </div>

          {/* Add item row */}
          <div className="border rounded-md p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Adicionar item</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Select value={selVariantId} onValueChange={setSelVariantId}>
                  <SelectTrigger><SelectValue placeholder="Produto / variante…" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      p.variants.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {p.title} — {v.title}
                          {v.stockOnHand <= 0 && " ⚠️ sem stock"}
                        </SelectItem>
                      ))
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Qtd</Label>
                <Input
                  type="number" min="1" value={selQty}
                  onChange={(e) => setSelQty(Number(e.target.value))}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Preço unit ({currency})</Label>
                <Input
                  type="number" min="0" step="0.01" value={selPrice}
                  onChange={(e) => setSelPrice(e.target.value)}
                  placeholder="0.00"
                  className="h-8 tabular-nums"
                />
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1">
              <Plus className="size-3" /> Adicionar
            </Button>
          </div>

          {/* Items list */}
          {items.length > 0 && (
            <div className="space-y-1">
              {items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm border rounded px-3 py-1.5">
                  <span>
                    {item.quantity}× {item.productTitle} <span className="text-muted-foreground">{item.variantTitle}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-medium">
                      €{(item.unitPrice * item.quantity).toFixed(2)}
                    </span>
                    <button type="button" onClick={() => setItems((p) => p.filter((_, j) => j !== i))}>
                      <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="text-xs text-muted-foreground pt-1 border-t flex justify-between">
                <span>Total: <strong>€{total.toFixed(2)}</strong></span>
                <span>COGS: €{totalCogs.toFixed(2)} · Gross profit: €{grossProfit.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notas (opcional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="…" />
          </div>

          <Button type="submit" className="w-full" disabled={pending || items.length === 0}>
            {pending ? "A guardar…" : "Registar venda"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

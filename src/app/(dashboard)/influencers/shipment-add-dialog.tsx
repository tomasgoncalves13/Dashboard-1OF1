"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addShipment } from "./actions";
import { toast } from "sonner";
import { Package, Plus, Trash2 } from "lucide-react";
import type { Prisma } from "@prisma/client";

type Variant = { id: string; title: string; unitCost: Prisma.Decimal | null; stockOnHand: number };
type Product = { id: string; title: string; variants: Variant[] };

type LineItem = {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  quantity: number;
  unitCost: number;
};

const CONTENT_TYPES = [
  { value: "VIDEO_AD", label: "Vídeo Ad" },
  { value: "STORY", label: "Story" },
  { value: "POST", label: "Post" },
  { value: "REEL", label: "Reel" },
  { value: "UGC", label: "UGC" },
  { value: "NO_POST", label: "Sem post" },
];

export function ShipmentAddDialog({
  influencerId,
  influencerName,
  products,
}: {
  influencerId: string;
  influencerName: string;
  products: Product[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState<LineItem[]>([]);
  const [selVariantId, setSelVariantId] = useState("");
  const [selQty, setSelQty] = useState(1);
  const [shippingCost, setShippingCost] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [contentType, setContentType] = useState("");
  const [notes, setNotes] = useState("");

  const allVariants = products.flatMap((p) =>
    p.variants.map((v) => ({ ...v, productTitle: p.title })),
  );
  const selectedVariant = allVariants.find((v) => v.id === selVariantId);

  function addItem() {
    if (!selVariantId || !selectedVariant) return;
    const existing = items.findIndex((i) => i.variantId === selVariantId);
    if (existing >= 0) {
      setItems((prev) =>
        prev.map((i, idx) =>
          idx === existing ? { ...i, quantity: i.quantity + selQty } : i,
        ),
      );
    } else {
      setItems((prev) => [
        ...prev,
        {
          variantId: selVariantId,
          productTitle: selectedVariant.productTitle,
          variantTitle: selectedVariant.title,
          quantity: selQty,
          unitCost: Number(selectedVariant.unitCost ?? 0),
        },
      ]);
    }
    setSelVariantId("");
    setSelQty(1);
  }

  const totalProductCost = items.reduce((s, i) => s + i.unitCost * i.quantity, 0);
  const totalCost = totalProductCost + Number(shippingCost || 0);

  function reset() {
    setItems([]);
    setSelVariantId("");
    setSelQty(1);
    setShippingCost("");
    setCarrier("");
    setTrackingNumber("");
    setContentType("");
    setNotes("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) { toast.error("Adiciona pelo menos 1 produto."); return; }
    startTransition(async () => {
      try {
        await addShipment({
          influencerId,
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, unitCost: i.unitCost })),
          shippingCost: Number(shippingCost || 0),
          carrier: carrier || undefined,
          trackingNumber: trackingNumber || undefined,
          contentType: contentType || undefined,
          notes: notes || undefined,
        });
        toast.success("Envio registado. Stock atualizado.");
        setOpen(false);
        reset();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao registar envio.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
          <Package className="size-3" /> Enviar produto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Envio para {influencerName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          {/* Add product row */}
          <div className="border rounded-md p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Produtos a enviar</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Select value={selVariantId} onValueChange={setSelVariantId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Produto / variante…" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) =>
                      p.variants.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {p.title} — {v.title}
                          {v.stockOnHand <= 0 && " ⚠️"}
                        </SelectItem>
                      )),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-1.5">
                <Input
                  type="number" min="1" value={selQty}
                  onChange={(e) => setSelQty(Number(e.target.value))}
                  className="h-8 w-16 text-xs tabular-nums"
                />
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-8 px-2">
                  <Plus className="size-3" />
                </Button>
              </div>
            </div>
            {items.length > 0 && (
              <div className="space-y-1 mt-1">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs border rounded px-2 py-1">
                    <span>
                      {item.quantity}× {item.productTitle}{" "}
                      <span className="text-muted-foreground">{item.variantTitle}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-muted-foreground">
                        custo: €{(item.unitCost * item.quantity).toFixed(2)}
                      </span>
                      <button type="button" onClick={() => setItems((p) => p.filter((_, j) => j !== i))}>
                        <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">
                  Custo produtos: €{totalProductCost.toFixed(2)} · Total c/ envio: €{totalCost.toFixed(2)}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Custo envio (€)</Label>
              <Input
                type="number" min="0" step="0.01" value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value)}
                placeholder="0.00" className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Transportadora</Label>
              <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="CTT, DHL…" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tracking</Label>
              <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="CT123456789PT" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Conteúdo esperado</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo…" /></SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notas</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="…" className="h-8 text-xs" />
          </div>

          <Button type="submit" className="w-full" disabled={pending || items.length === 0}>
            {pending ? "A guardar…" : "Registar envio"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

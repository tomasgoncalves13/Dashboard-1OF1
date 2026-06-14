"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createPurchaseOrder, type NewOrderItem } from "./actions";
import { toast } from "sonner";

const emptyItem = (): NewOrderItem => ({
  productName: "",
  quantity: null,
  productionCost: null,
  transportCost: null,
  totalCost: 0,
  unitCost: null,
  note: null,
});

export function NewOrderDialog({ nextNumber }: { nextNumber: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [orderNumber, setOrderNumber] = useState(String(nextNumber));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<NewOrderItem[]>([emptyItem()]);

  function updateItem(i: number, field: keyof NewOrderItem, value: string) {
    setItems((prev) => {
      const next = [...prev];
      const num = parseFloat(value);
      (next[i] as Record<string, unknown>)[field] = field === "productName" || field === "note"
        ? value
        : isNaN(num) ? null : num;
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplier.trim() || items.some((i) => !i.productName.trim() || !i.totalCost)) {
      toast.error("Preenche fornecedor e custo total de cada item.");
      return;
    }
    startTransition(async () => {
      try {
        await createPurchaseOrder({ orderNumber: Number(orderNumber), date, supplier, notes, items });
        toast.success("Encomenda registada.");
        setOpen(false);
        setItems([emptyItem()]);
        setSupplier("");
        setNotes("");
      } catch {
        toast.error("Erro ao criar encomenda.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="size-4 mr-1" />Nova Encomenda</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Encomenda a Fornecedor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Nº Encomenda</Label>
              <Input type="number" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-3">
              <Label>Fornecedor</Label>
              <Input placeholder="Ex: Zhejiang Fele Sports" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-3">
              <Label>Notas</Label>
              <Input placeholder="Opcional" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Itens</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setItems((p) => [...p, emptyItem()])}>
                <Plus className="size-3 mr-1" />Item
              </Button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="border rounded-md p-3 space-y-2">
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Produto"
                    value={item.productName}
                    onChange={(e) => updateItem(i, "productName", e.target.value)}
                  />
                  <Input
                    className="w-24"
                    type="number"
                    placeholder="Qtd"
                    value={item.quantity ?? ""}
                    onChange={(e) => updateItem(i, "quantity", e.target.value)}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setItems((p) => p.filter((_, j) => j !== i))}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { field: "productionCost" as const, label: "Produção €" },
                    { field: "transportCost" as const, label: "Transporte €" },
                    { field: "totalCost" as const, label: "Total €*" },
                    { field: "unitCost" as const, label: "€/unidade" },
                  ].map(({ field, label }) => (
                    <div key={field} className="space-y-1">
                      <Label className="text-xs">{label}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item[field] ?? ""}
                        onChange={(e) => updateItem(i, field, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <Input
                  placeholder="Nota (ex: fornecedor, tamanhos)"
                  value={item.note ?? ""}
                  onChange={(e) => updateItem(i, "note", e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "A guardar…" : "Criar Encomenda"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

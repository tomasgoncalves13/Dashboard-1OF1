"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { actionAddClubMonth } from "./actions";
import { toast } from "sonner";
import { CalendarPlus, Plus, Trash2 } from "lucide-react";

type Club = { id: string; name: string };
type InventoryProduct = {
  variantId: string;
  name: string;
  family: string;
  stockOnHand: number;
  unitCost: number;
};
type Props = { clubs: Club[]; inventoryProducts: InventoryProduct[]; currency: string };
type LineItem = { variantId: string; name: string; quantity: number; unitCost: number };

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function AddMonthDialog({ clubs, inventoryProducts, currency }: Props) {
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [clubId, setClubId] = useState("");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [monthlyRevenue, setMonthlyRevenue] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [selVariantId, setSelVariantId] = useState("");
  const [selQty, setSelQty] = useState(1);

  const selected = inventoryProducts.find((p) => p.variantId === selVariantId);
  const byFamily = inventoryProducts.reduce<Record<string, InventoryProduct[]>>((acc, p) => {
    (acc[p.family] ??= []).push(p);
    return acc;
  }, {});

  function addItem() {
    if (!selVariantId || !selected) return;
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.variantId === selVariantId);
      if (idx >= 0) return prev.map((i, j) => j === idx ? { ...i, quantity: i.quantity + selQty } : i);
      return [...prev, { variantId: selVariantId, name: selected.name, quantity: selQty, unitCost: selected.unitCost }];
    });
    setSelVariantId("");
    setSelQty(1);
  }

  const totalCogs = items.reduce((s, i) => s + i.unitCost * i.quantity, 0);
  const revenue = Number(monthlyRevenue) || 0;
  const grossProfit = revenue - totalCogs;

  function reset() {
    setClubId("");
    setMonthlyRevenue("");
    setItems([]);
    setSelVariantId("");
    setSelQty(1);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clubId) { toast.error("Seleciona um clube."); return; }
    if (items.length === 0) { toast.error("Adiciona pelo menos 1 produto."); return; }
    if (revenue <= 0) { toast.error("Mete a receita do mês."); return; }
    startTransition(async () => {
      try {
        await actionAddClubMonth({
          clubId, year, month,
          monthlyRevenue: revenue,
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, unitCost: i.unitCost })),
        });
        toast.success("Mês adicionado.");
        setOpen(false);
        reset();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao adicionar mês.");
      }
    });
  }

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <CalendarPlus className="size-4" /> Adicionar mês
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar mês de clube</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Clube</Label>
            <Select value={clubId} onValueChange={setClubId}>
              <SelectTrigger><SelectValue placeholder="Seleciona clube…" /></SelectTrigger>
              <SelectContent>
                {clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mês</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ano</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Receita total do mês ({currency})</Label>
            <Input
              type="number" min="0" step="0.01"
              value={monthlyRevenue}
              onChange={(e) => setMonthlyRevenue(e.target.value)}
              placeholder="0.00"
              className="tabular-nums"
            />
          </div>

          <div className="border rounded-md p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Produtos vendidos (para calcular custo)</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Select value={selVariantId} onValueChange={setSelVariantId}>
                  <SelectTrigger><SelectValue placeholder="Produto…" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(byFamily).map(([family, products]) => (
                      <SelectGroup key={family}>
                        <SelectLabel>{family}</SelectLabel>
                        {products.map((p) => (
                          <SelectItem key={p.variantId} value={p.variantId}>
                            {p.name}{p.stockOnHand <= 0 && " ⚠️ sem stock"}
                          </SelectItem>
                        ))}
                      </SelectGroup>
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
              <div className="flex items-end">
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1 h-8">
                  <Plus className="size-3" /> Adicionar
                </Button>
              </div>
            </div>
          </div>

          {items.length > 0 && (
            <div className="space-y-1">
              {items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm border rounded px-3 py-1.5">
                  <span>{item.quantity}× {item.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-muted-foreground text-xs">
                      custo €{(item.unitCost * item.quantity).toFixed(2)}
                    </span>
                    <button type="button" onClick={() => setItems((p) => p.filter((_, j) => j !== i))}>
                      <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="text-xs text-muted-foreground pt-1 border-t flex justify-between">
                <span>Custo produtos: <strong>€{totalCogs.toFixed(2)}</strong></span>
                {revenue > 0 && (
                  <span>Lucro bruto estimado: <strong>€{grossProfit.toFixed(2)}</strong></span>
                )}
              </div>
            </div>
          )}

          <Button
            type="submit" className="w-full"
            disabled={pending || !clubId || items.length === 0 || revenue <= 0}
          >
            {pending ? "A guardar…" : "Adicionar mês"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

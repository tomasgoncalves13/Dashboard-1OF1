"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addExpense } from "./actions";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const CATEGORIES = [
  ["META_ADS", "Meta Ads"],["GOOGLE_ADS", "Google Ads"],["TIKTOK_ADS", "TikTok Ads"],
  ["SOFTWARE", "Software"],["SHOPIFY_APPS", "Shopify Apps"],["FREELANCERS", "Freelancers"],
  ["SUPPLIERS", "Fornecedores"],["BULK_INVENTORY", "Stock a granel"],["SHIPPING", "Envios"],
  ["PACKAGING", "Embalagem"],["INFLUENCERS", "Influencers"],["SUBSCRIPTIONS", "Subscrições"],
  ["TAXES", "Impostos"],["RENT", "Renda"],["TRAVEL", "Viagens"],["EVENTS", "Eventos"],["MISC", "Outros"],
] as const;

export function ExpenseAddDialog({ storeId }: { storeId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [incurredOn, setIncurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [recurring, setRecurring] = useState(false);
  const [period, setPeriod] = useState("MONTHLY");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || !amount) return;
    startTransition(async () => {
      try {
        await addExpense({
          category: category as string,
          amount: Number(amount),
          vendor: vendor || undefined,
          description: description || undefined,
          incurredOn,
          recurring,
          recurringPeriod: recurring ? period : undefined,
        });
        toast.success("Despesa adicionada.");
        setOpen(false);
        setAmount(""); setVendor(""); setDescription(""); setCategory("");
      } catch {
        toast.error("Erro ao guardar despesa.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1"><Plus className="size-4" /> Adicionar despesa</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nova despesa</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger><SelectValue placeholder="Seleciona…" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor (€)</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={incurredOn} onChange={(e) => setIncurredOn(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Fornecedor</Label>
            <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Ex: Meta, Shopify…" />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Notas…" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="rec" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="size-4" />
            <label htmlFor="rec" className="text-sm">Recorrente</label>
            {recurring && (
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Semanal</SelectItem>
                  <SelectItem value="MONTHLY">Mensal</SelectItem>
                  <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                  <SelectItem value="YEARLY">Anual</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "A guardar…" : "Adicionar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

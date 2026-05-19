"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { actionCreateClub } from "./actions";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const DEFAULT_TIERS = [
  { upTo: 100, rate: 0.25 },
  { upTo: 300, rate: 0.30 },
  { upTo: null, rate: 0.35 },
];

export function ClubCreateDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [commission, setCommission] = useState(true);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        await actionCreateClub({
          name: name.trim(),
          commissionEnabled: commission,
          commissionTiers: DEFAULT_TIERS,
        });
        toast.success(`Clube "${name}" criado.`);
        setOpen(false);
        setName("");
      } catch {
        toast.error("Erro ao criar clube.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Plus className="size-4" /> Novo clube
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Criar clube</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="club-name">Nome do clube</Label>
            <Input
              id="club-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Candal FC"
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="commission"
              checked={commission}
              onChange={(e) => setCommission(e.target.checked)}
              className="size-4"
            />
            <Label htmlFor="commission">Comissão ativa (progressiva: 25%/30%/35%)</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Os tiers de comissão e preços por produto podem ser configurados no detalhe do clube.
          </p>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "A criar…" : "Criar clube"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addInfluencer } from "./actions";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export function InfluencerAddDialog({ storeId }: { storeId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "", handle: "", platform: "instagram",
    email: "", country: "PT", followers: "", discountCode: "", notes: "",
  });

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    startTransition(async () => {
      try {
        await addInfluencer({
          name: form.name.trim(),
          handle: form.handle || undefined,
          platform: form.platform || undefined,
          email: form.email || undefined,
          country: form.country || undefined,
          followers: form.followers ? Number(form.followers) : undefined,
          discountCode: form.discountCode || undefined,
          notes: form.notes || undefined,
        });
        toast.success(`Influencer "${form.name}" adicionado.`);
        setOpen(false);
        setForm({ name: "", handle: "", platform: "instagram", email: "", country: "PT", followers: "", discountCode: "", notes: "" });
      } catch {
        toast.error("Erro ao adicionar influencer.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1"><Plus className="size-4" /> Novo influencer</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Adicionar influencer</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="Nome completo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>@Handle</Label>
              <Input value={form.handle} onChange={(e) => set("handle", e.target.value)} placeholder="@username" />
            </div>
            <div className="space-y-1.5">
              <Label>Plataforma</Label>
              <Select value={form.platform} onValueChange={(v) => set("platform", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Seguidores</Label>
              <Input type="number" value={form.followers} onChange={(e) => set("followers", e.target.value)} placeholder="Ex: 50000" />
            </div>
            <div className="space-y-1.5">
              <Label>País</Label>
              <Input value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="PT" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Código desconto</Label>
            <Input value={form.discountCode} onChange={(e) => set("discountCode", e.target.value)} placeholder="Ex: CREATOR10" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="…" />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "A guardar…" : "Adicionar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

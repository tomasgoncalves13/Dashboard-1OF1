"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon } from "lucide-react";
import { scheduleFbPost } from "./actions";

export function ScheduleFbPostDialog({ pageId }: { pageId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ message: "", link: "", scheduledAt: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await scheduleFbPost({
        pageId,
        message: form.message,
        link: form.link || undefined,
        scheduledAt: form.scheduledAt || null,
      });
      setOpen(false);
      setForm({ message: "", link: "", scheduledAt: "" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CalendarIcon className="size-4 mr-2" />
          Agendar publicação
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publicar no Facebook</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Texto</Label>
            <Textarea
              placeholder="Escreve o texto da publicação..."
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              rows={4}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Link (opcional)</Label>
            <Input
              placeholder="https://..."
              value={form.link}
              onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Agendar para (opcional — vazio = publicar agora)</Label>
            <Input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "A publicar..." : form.scheduledAt ? "Agendar" : "Publicar agora"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

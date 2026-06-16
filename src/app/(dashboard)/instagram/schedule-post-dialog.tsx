"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon } from "lucide-react";
import { scheduleIgPost } from "./actions";

export function SchedulePostDialog({ igId }: { igId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ mediaUrl: "", caption: "", scheduledAt: "", isVideo: false });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await scheduleIgPost({
        igId,
        mediaUrl: form.mediaUrl,
        caption: form.caption,
        scheduledAt: form.scheduledAt || null,
        isVideo: form.isVideo,
      });
      setOpen(false);
      setForm({ mediaUrl: "", caption: "", scheduledAt: "", isVideo: false });
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
          <DialogTitle>Publicar no Instagram</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo de conteúdo</Label>
            <select
              value={form.isVideo ? "video" : "image"}
              onChange={(e) => setForm((f) => ({ ...f, isVideo: e.target.value === "video" }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="image">Imagem / Foto</option>
              <option value="video">Vídeo / Reel</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>URL {form.isVideo ? "do vídeo" : "da imagem"}</Label>
            <Input
              placeholder="https://..."
              value={form.mediaUrl}
              onChange={(e) => setForm((f) => ({ ...f, mediaUrl: e.target.value }))}
              required
            />
            <p className="text-xs text-muted-foreground">
              Link público {form.isVideo ? "(MP4)" : "(JPEG/PNG)"}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Legenda</Label>
            <Textarea
              placeholder="Escreve a legenda..."
              value={form.caption}
              onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
              rows={4}
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

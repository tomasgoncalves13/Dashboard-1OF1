"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud } from "lucide-react";
import { uploadTikTokDraft } from "./actions";

export function UploadDraftDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await uploadTikTokDraft({ videoUrl });
      setDone(true);
      setVideoUrl("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setDone(false);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UploadCloud className="size-4 mr-2" />
          Enviar vídeo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar vídeo para o TikTok</DialogTitle>
        </DialogHeader>
        {done ? (
          <p className="text-sm text-muted-foreground">
            Vídeo enviado para a inbox do TikTok. Abre a app TikTok no telemóvel da conta para
            reveres e publicares — a API só permite agendamento/publicação direta depois de
            aprovação da TikTok.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>URL do vídeo (MP4 público)</Label>
              <Input
                placeholder="https://..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                O vídeo é enviado como rascunho para a inbox do TikTok — tens de abrir a app e
                publicar manualmente.
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "A enviar..." : "Enviar para o TikTok"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

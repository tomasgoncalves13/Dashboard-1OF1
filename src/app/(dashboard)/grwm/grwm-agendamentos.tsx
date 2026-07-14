"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, Clock, Instagram, Facebook, Music2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ScheduledPost } from "./actions";

function StatusBadge({ post }: { post: ScheduledPost }) {
  if (post.errorMsg && !post.published) {
    return <Badge variant="destructive">Erro</Badge>;
  }
  if (post.published) {
    return <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">Publicado</Badge>;
  }
  const today = new Date().toISOString().slice(0, 10);
  if (post.scheduledDate < today) {
    return <Badge variant="outline" className="text-amber-600 border-amber-400">Em falta</Badge>;
  }
  return <Badge variant="outline">Pendente</Badge>;
}

export function GrwmAgendamentos({ posts }: { posts: ScheduledPost[] }) {
  if (posts.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
        Nenhum post agendado. Usa o separador "Novo Agendamento" para criar uma agenda.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Os posts são publicados automaticamente às 18:00 (Lisboa) via Vercel Cron. O TikTok vai para a
        creator inbox — publica manualmente pela app.
      </p>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="py-2.5 px-3 text-left font-medium w-8">#</th>
              <th className="py-2.5 px-3 text-left font-medium w-28">Data</th>
              <th className="py-2.5 px-3 text-left font-medium">Legenda</th>
              <th className="py-2.5 px-3 text-center font-medium w-28">Plataformas</th>
              <th className="py-2.5 px-3 text-center font-medium w-24">Estado</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post, i) => {
              const date = parseISO(post.scheduledDate);
              const hasError = !!post.errorMsg;

              return (
                <tr
                  key={post.id}
                  className={`border-b last:border-0 transition-colors ${
                    post.published
                      ? "bg-green-500/5"
                      : hasError
                        ? "bg-destructive/5"
                        : ""
                  }`}
                >
                  <td className="py-2.5 px-3 text-muted-foreground font-mono text-xs">{i + 1}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-xs">
                      {format(date, "EEE dd MMM", { locale: ptBR })}
                    </div>
                    <div className="text-xs text-muted-foreground">18:00</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="text-xs leading-relaxed">{post.caption}</div>
                    <a
                      href={post.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                    >
                      <ExternalLink className="size-3" />
                      Ver vídeo
                    </a>
                    {hasError && (
                      <p className="text-xs text-destructive mt-1">{post.errorMsg}</p>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center justify-center gap-2">
                      <span title={`Instagram${post.igMediaId ? ` (${post.igMediaId})` : ""}`}>
                        <Instagram
                          className={`size-4 ${post.igMediaId ? "text-pink-500" : "text-muted-foreground/40"}`}
                        />
                      </span>
                      <span title={`TikTok${post.tiktokPublishId ? ` (${post.tiktokPublishId})` : ""}`}>
                        <Music2
                          className={`size-4 ${post.tiktokPublishId ? "text-sky-500" : "text-muted-foreground/40"}`}
                        />
                      </span>
                      <span title={`Facebook${post.fbPostId ? ` (${post.fbPostId})` : ""}`}>
                        <Facebook
                          className={`size-4 ${post.fbPostId ? "text-blue-600" : "text-muted-foreground/40"}`}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <StatusBadge post={post} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="size-3 text-green-500" />
          Publicado
        </span>
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          Pendente
        </span>
        <span className="flex items-center gap-1">
          <XCircle className="size-3 text-destructive" />
          Erro
        </span>
      </div>
    </div>
  );
}

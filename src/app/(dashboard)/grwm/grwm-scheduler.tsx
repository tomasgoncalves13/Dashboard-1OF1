"use client";

import { useState, useCallback } from "react";
import { format, addDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { scheduleSinglePost, type GripGroup, type VideoFile } from "./actions";

const GRIP_EMOJIS: Record<string, string> = {
  Amarela: "⚡️",
  Azul: "💙",
  Verde: "💚",
  Vermelha: "🔴",
  Branca: "🤍",
  Preta: "🖤",
};

function makeCaption(gripColor: string, sleeveColor: string): string {
  const emoji = GRIP_EMOJIS[gripColor] ?? "⚽";
  return `Meia Antiderrapante ${gripColor} + Meia Cortada ${sleeveColor} ${emoji}#1OF1Futbol #gripsocks #shinpads`;
}

interface Combo {
  key: string;
  gripColor: string;
  sleeveColor: string;
  videos: VideoFile[];
  label: string;
}

function buildCombos(groups: GripGroup[]): Combo[] {
  return groups.flatMap((g) =>
    g.sleeves.map((s) => ({
      key: `${g.gripColor}/${s.sleeveColor}`,
      gripColor: g.gripColor,
      sleeveColor: s.sleeveColor,
      videos: s.videos,
      label: `Grip ${g.gripColor} / Sleeve ${s.sleeveColor}`,
    }))
  );
}

type SlotStatus = "idle" | "uploading" | "done" | "error";

interface DaySlot {
  comboKey: string;
  videoPath: string;
  caption: string;
  status: SlotStatus;
  error?: string;
}

function buildDefaultSlots(combos: Combo[]): DaySlot[] {
  if (combos.length === 0) return [];
  return Array.from({ length: 14 }, (_, i) => {
    const combo = combos[i % combos.length];
    return {
      comboKey: combo.key,
      videoPath: combo.videos[0]?.fullPath ?? "",
      caption: makeCaption(combo.gripColor, combo.sleeveColor),
      status: "idle",
    };
  });
}

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return format(d, "yyyy-MM-dd");
}

export function GrwmScheduler({ groups, igId }: { groups: GripGroup[]; igId: string }) {
  const combos = buildCombos(groups);
  const comboMap = Object.fromEntries(combos.map((c) => [c.key, c]));

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [slots, setSlots] = useState<DaySlot[]>(() => buildDefaultSlots(combos));
  const [scheduling, setScheduling] = useState(false);
  const [globalError, setGlobalError] = useState("");

  const updateSlot = useCallback(
    (i: number, patch: Partial<DaySlot>) =>
      setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s))),
    []
  );

  function handleComboChange(i: number, key: string) {
    const combo = comboMap[key];
    if (!combo) return;
    updateSlot(i, {
      comboKey: key,
      videoPath: combo.videos[0]?.fullPath ?? "",
      caption: makeCaption(combo.gripColor, combo.sleeveColor),
    });
  }

  async function handleSchedule() {
    if (!igId) {
      setGlobalError("Instagram Business Account não encontrado. Verifica as credenciais Meta.");
      return;
    }
    setGlobalError("");
    setScheduling(true);

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (slot.status === "done") continue;
      if (!slot.videoPath) {
        updateSlot(i, { status: "error", error: "Nenhum vídeo selecionado" });
        continue;
      }

      updateSlot(i, { status: "uploading" });

      const result = await scheduleSinglePost({
        videoPath: slot.videoPath,
        caption: slot.caption,
        dayIndex: i,
        startDate,
        igId,
      });

      if (result.success) {
        updateSlot(i, { status: "done" });
      } else {
        updateSlot(i, { status: "error", error: result.error });
      }
    }

    setScheduling(false);
  }

  const doneCount = slots.filter((s) => s.status === "done").length;
  const errorCount = slots.filter((s) => s.status === "error").length;

  if (combos.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
        Nenhum vídeo encontrado na pasta GRWM (excluindo Publicados).
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Start date */}
      <div className="flex items-end gap-4">
        <div className="space-y-1.5">
          <Label>
            <Calendar className="inline size-3.5 mr-1" />
            Data de início
          </Label>
          <Input
            type="date"
            value={startDate}
            min={format(new Date(), "yyyy-MM-dd")}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-44"
            disabled={scheduling}
          />
        </div>
        <p className="text-xs text-muted-foreground pb-2">
          Os posts serão agendados às 18:00 (hora Lisboa) durante 14 dias consecutivos.
        </p>
      </div>

      {/* Schedule table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="py-2.5 px-3 text-left font-medium w-10">Dia</th>
              <th className="py-2.5 px-3 text-left font-medium w-28">Data</th>
              <th className="py-2.5 px-3 text-left font-medium w-56">Combinação</th>
              <th className="py-2.5 px-3 text-left font-medium w-36">Vídeo</th>
              <th className="py-2.5 px-3 text-left font-medium">Legenda</th>
              <th className="py-2.5 px-3 text-center font-medium w-16">Estado</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, i) => {
              const date = addDays(parseISO(startDate), i);
              const combo = comboMap[slot.comboKey];
              const videos = combo?.videos ?? [];
              const isActive = scheduling && slot.status === "uploading";

              return (
                <tr
                  key={i}
                  className={`border-b last:border-0 transition-colors ${
                    slot.status === "done"
                      ? "bg-green-500/5"
                      : slot.status === "error"
                        ? "bg-destructive/5"
                        : isActive
                          ? "bg-primary/5"
                          : ""
                  }`}
                >
                  <td className="py-2 px-3 text-muted-foreground font-mono">{i + 1}</td>
                  <td className="py-2 px-3 text-xs">
                    {format(date, "EEE dd MMM", { locale: ptBR })}
                    <span className="block text-muted-foreground">18:00</span>
                  </td>
                  <td className="py-2 px-3">
                    <Select
                      value={slot.comboKey}
                      onValueChange={(v) => handleComboChange(i, v)}
                      disabled={scheduling}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {combos.map((c) => (
                          <SelectItem key={c.key} value={c.key} className="text-xs">
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-2 px-3">
                    <Select
                      value={slot.videoPath}
                      onValueChange={(v) => updateSlot(i, { videoPath: v })}
                      disabled={scheduling || videos.length === 0}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {videos.map((v) => (
                          <SelectItem key={v.fullPath} value={v.fullPath} className="text-xs">
                            {v.duration}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-2 px-3">
                    <Textarea
                      value={slot.caption}
                      onChange={(e) => updateSlot(i, { caption: e.target.value })}
                      disabled={scheduling}
                      rows={2}
                      className="text-xs min-h-0 resize-none"
                    />
                    {slot.status === "error" && (
                      <p className="text-xs text-destructive mt-1">{slot.error}</p>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {slot.status === "uploading" && (
                      <Loader2 className="size-4 animate-spin mx-auto text-primary" />
                    )}
                    {slot.status === "done" && (
                      <CheckCircle2 className="size-4 mx-auto text-green-500" />
                    )}
                    {slot.status === "error" && (
                      <XCircle className="size-4 mx-auto text-destructive" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Progress summary */}
      {(doneCount > 0 || errorCount > 0) && (
        <div className="text-sm text-muted-foreground flex gap-4">
          {doneCount > 0 && (
            <span className="text-green-600">
              {doneCount} agendado{doneCount !== 1 ? "s" : ""} no Instagram + TikTok draft
            </span>
          )}
          {errorCount > 0 && (
            <span className="text-destructive">
              {errorCount} com erro — verifica acima
            </span>
          )}
        </div>
      )}

      {globalError && <p className="text-sm text-destructive">{globalError}</p>}

      {/* Action button */}
      <Button
        size="lg"
        onClick={handleSchedule}
        disabled={scheduling || doneCount === slots.length}
        className="w-full sm:w-auto"
      >
        {scheduling ? (
          <>
            <Loader2 className="size-4 mr-2 animate-spin" />
            A agendar… ({doneCount + errorCount}/{slots.length})
          </>
        ) : doneCount === slots.length ? (
          <>
            <CheckCircle2 className="size-4 mr-2" />
            Todos agendados
          </>
        ) : (
          `Agendar ${slots.length - doneCount} posts`
        )}
      </Button>

      <p className="text-xs text-muted-foreground">
        Cada vídeo é carregado para Supabase Storage (~30–60s por ficheiro). O TikTok vai para a
        creator inbox — publica manualmente pela app.
      </p>
    </div>
  );
}

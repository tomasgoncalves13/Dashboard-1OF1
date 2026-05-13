"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RangePreset } from "@/lib/dashboard/range";

const PRESETS: { value: Exclude<RangePreset, "custom">; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "365d", label: "365 dias" },
];

export function DateRangePicker({ active }: { active: RangePreset }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, start] = useTransition();
  const [customOpen, setCustomOpen] = useState(active === "custom");
  const [from, setFrom] = useState(search.get("from") ?? "");
  const [to, setTo] = useState(search.get("to") ?? "");

  function setPreset(p: RangePreset) {
    const params = new URLSearchParams();
    params.set("range", p);
    if (p === "custom") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      setCustomOpen(true);
    } else {
      setCustomOpen(false);
    }
    start(() => router.push(`${pathname}?${params.toString()}`));
  }

  function applyCustom() {
    if (!from || !to) return;
    const params = new URLSearchParams();
    params.set("range", "custom");
    params.set("from", from);
    params.set("to", to);
    start(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.value}
            type="button"
            size="sm"
            variant={active === p.value ? "default" : "outline"}
            disabled={pending}
            onClick={() => setPreset(p.value)}
          >
            {p.label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={active === "custom" ? "default" : "outline"}
          disabled={pending}
          onClick={() => setCustomOpen((v) => !v)}
        >
          Personalizado
        </Button>
      </div>

      {customOpen && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">De</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Até</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <Button type="button" size="sm" onClick={applyCustom} disabled={pending || !from || !to}>
            Aplicar
          </Button>
        </div>
      )}
    </div>
  );
}

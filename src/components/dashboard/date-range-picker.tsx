"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RangePreset } from "@/lib/dashboard/range";

const PRESETS: { value: Exclude<RangePreset, "custom" | "month">; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "365d", label: "365 dias" },
];

function getMonths() {
  const now = new Date();
  return Array.from({ length: 13 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const raw = d.toLocaleString("pt-PT", { month: "long", year: "numeric" });
    return { value, label: raw.charAt(0).toUpperCase() + raw.slice(1) };
  });
}

export function DateRangePicker({ active }: { active: RangePreset }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, start] = useTransition();
  const [monthOpen, setMonthOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(active === "custom");
  const [from, setFrom] = useState(search.get("from") ?? "");
  const [to, setTo] = useState(search.get("to") ?? "");
  const monthRef = useRef<HTMLDivElement>(null);

  const months = getMonths();
  const activeMonth = search.get("month") ?? months[0].value;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (monthRef.current && !monthRef.current.contains(e.target as Node)) {
        setMonthOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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

  function selectMonth(month: string) {
    const params = new URLSearchParams();
    params.set("range", "month");
    params.set("month", month);
    setMonthOpen(false);
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

  const activeMonthLabel = months.find((m) => m.value === activeMonth)?.label;

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

        {/* Mês dropdown */}
        <div className="relative" ref={monthRef}>
          <Button
            type="button"
            size="sm"
            variant={active === "month" ? "default" : "outline"}
            disabled={pending}
            onClick={() => { setMonthOpen((v) => !v); setCustomOpen(false); }}
          >
            {active === "month" ? activeMonthLabel : "Mês"}
          </Button>
          {monthOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-popover border rounded-md shadow-md py-1 min-w-[160px]">
              {months.map((m) => (
                <button
                  key={m.value}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors ${
                    active === "month" && activeMonth === m.value ? "font-semibold text-primary" : ""
                  }`}
                  onClick={() => selectMonth(m.value)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          variant={active === "custom" ? "default" : "outline"}
          disabled={pending}
          onClick={() => { setCustomOpen((v) => !v); setMonthOpen(false); }}
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

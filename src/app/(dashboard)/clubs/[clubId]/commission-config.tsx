"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { actionUpdateClub } from "../actions";
import { toast } from "sonner";
import { calculateProgressiveCommission, type CommissionTier } from "@/lib/clubs/commission";

type Props = { clubId: string; commissionEnabled: boolean; commissionTiers: unknown };

function parseTiers(raw: unknown): CommissionTier[] {
  if (!Array.isArray(raw)) return [];
  return raw as CommissionTier[];
}

export function CommissionConfig({ clubId, commissionEnabled, commissionTiers }: Props) {
  const [enabled, setEnabled] = useState(commissionEnabled);
  const [tiers, setTiers] = useState<CommissionTier[]>(parseTiers(commissionTiers));
  const [pending, startTransition] = useTransition();

  const exampleRevenues = [50, 100, 200, 300, 500];

  function save() {
    startTransition(async () => {
      try {
        await actionUpdateClub(clubId, { commissionEnabled: enabled, commissionTiers: tiers });
        toast.success("Comissão atualizada.");
      } catch {
        toast.error("Erro ao guardar.");
      }
    });
  }

  function updateTier(i: number, field: "upTo" | "rate", value: string) {
    setTiers((prev) => {
      const next = [...prev];
      if (field === "upTo") next[i] = { ...next[i], upTo: value === "" ? null : Number(value) };
      else next[i] = { ...next[i], rate: Number(value) / 100 };
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input type="checkbox" id="comm-enabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4" />
        <label htmlFor="comm-enabled" className="text-sm">Comissão ativa</label>
      </div>

      {enabled && (
        <>
          <div className="space-y-1">
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mb-1">
              <span>Até (€, vazio = topo)</span>
              <span>Taxa (%)</span>
              <span></span>
            </div>
            {tiers.map((tier, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <Input
                  type="number" min="0" step="1"
                  value={tier.upTo ?? ""}
                  onChange={(e) => updateTier(i, "upTo", e.target.value)}
                  placeholder="∞"
                  className="h-8 text-sm tabular-nums"
                />
                <Input
                  type="number" min="0" max="100" step="0.5"
                  value={(tier.rate * 100).toFixed(1)}
                  onChange={(e) => updateTier(i, "rate", e.target.value)}
                  className="h-8 text-sm tabular-nums"
                />
                <Button
                  size="sm" variant="ghost" className="h-8 text-xs"
                  onClick={() => setTiers((p) => p.filter((_, j) => j !== i))}
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button
              size="sm" variant="outline" className="text-xs mt-1"
              onClick={() => setTiers((p) => [...p, { upTo: null, rate: 0.35 }])}
            >
              + Adicionar tier
            </Button>
          </div>

          {/* Preview */}
          <div className="border rounded p-3 bg-muted/20 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Preview comissão mensal</p>
            <div className="grid grid-cols-3 text-xs text-muted-foreground border-b pb-1 mb-1">
              <span>Revenue mês</span>
              <span className="text-right">Comissão</span>
              <span className="text-right">% efectiva</span>
            </div>
            {exampleRevenues.map((rev) => {
              const comm = calculateProgressiveCommission(rev, tiers);
              return (
                <div key={rev} className="grid grid-cols-3 text-xs">
                  <span>€{rev}</span>
                  <span className="text-right tabular-nums">€{comm.toFixed(2)}</span>
                  <span className="text-right tabular-nums">{rev > 0 ? ((comm / rev) * 100).toFixed(1) : 0}%</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Button size="sm" onClick={save} disabled={pending}>
        {pending ? "A guardar…" : "Guardar comissão"}
      </Button>
    </div>
  );
}

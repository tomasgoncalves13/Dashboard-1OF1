"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShipmentAddDialog } from "./shipment-add-dialog";
import { updateInfluencerStatus, updateInfluencerRevenue } from "./actions";
import { formatMoney } from "@/lib/utils";
import { toast } from "sonner";
import type { Prisma } from "@prisma/client";

type Variant = { id: string; title: string; unitCost: Prisma.Decimal | null; stockOnHand: number };
type Product = { id: string; title: string; variants: Variant[] };

type Shipment = {
  status: string;
  shippingCost: Prisma.Decimal;
  items: { unitCost: Prisma.Decimal; quantity: number }[];
};

type Influencer = {
  id: string;
  name: string;
  handle: string | null;
  platform: string | null;
  followers: number | null;
  discountCode: string | null;
  status: string;
  attributedRevenue: Prisma.Decimal;
  shipments: Shipment[];
  payments: { amount: Prisma.Decimal }[];
};

const STATUS_OPTIONS = [
  { value: "PROSPECT", label: "Prospecto" },
  { value: "CONTACTED", label: "Contactado" },
  { value: "ACTIVE", label: "Activo" },
  { value: "COMPLETED", label: "Concluído" },
  { value: "PAUSED", label: "Pausado" },
  { value: "BLACKLIST", label: "Blacklist" },
];

const STATUS_COLORS: Record<string, string> = {
  PROSPECT: "bg-gray-100 text-gray-600",
  CONTACTED: "bg-blue-100 text-blue-700",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-purple-100 text-purple-700",
  PAUSED: "bg-amber-100 text-amber-700",
  BLACKLIST: "bg-red-100 text-red-700",
};

export function InfluencerCard({
  influencer,
  currency,
  products,
}: {
  influencer: Influencer;
  currency: string;
  products: Product[];
}) {
  const [status, setStatus] = useState(influencer.status);
  const [editingRevenue, setEditingRevenue] = useState(false);
  const [revenueInput, setRevenueInput] = useState(Number(influencer.attributedRevenue).toFixed(2));
  const [, startTransition] = useTransition();

  const productCost = influencer.shipments.reduce(
    (s, sh) =>
      s + sh.items.reduce((ss, it) => ss + Number(it.unitCost) * it.quantity, 0) + Number(sh.shippingCost),
    0,
  );
  const payments = influencer.payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalCost = productCost + payments;
  const revenue = Number(influencer.attributedRevenue);
  const roi = revenue - totalCost;

  function handleStatusChange(newStatus: string) {
    setStatus(newStatus);
    startTransition(async () => {
      try {
        await updateInfluencerStatus(influencer.id, newStatus);
      } catch {
        setStatus(status);
        toast.error("Erro ao atualizar status.");
      }
    });
  }

  function saveRevenue() {
    const val = Number(revenueInput);
    if (isNaN(val)) return;
    startTransition(async () => {
      try {
        await updateInfluencerRevenue(influencer.id, val);
        toast.success("Revenue atualizado.");
        setEditingRevenue(false);
      } catch {
        toast.error("Erro ao atualizar revenue.");
      }
    });
  }

  return (
    <Card className="hover:bg-accent/20 transition-colors">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold truncate">{influencer.name}</p>
            <p className="text-xs text-muted-foreground">
              {influencer.handle ? `@${influencer.handle}` : ""}
              {influencer.platform ? ` · ${influencer.platform}` : ""}
              {influencer.followers ? ` · ${(influencer.followers / 1000).toFixed(1)}k` : ""}
            </p>
          </div>
          {influencer.discountCode && (
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono shrink-0">
              {influencer.discountCode}
            </span>
          )}
        </div>

        {/* Inline status change */}
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className={`h-7 text-xs border-0 px-2 rounded ${STATUS_COLORS[status] ?? ""}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* ROI metrics */}
        <div className="grid grid-cols-3 gap-1 text-xs">
          <div>
            <p className="text-muted-foreground">Custo total</p>
            <p className="font-medium tabular-nums">{formatMoney(totalCost, currency)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Revenue</p>
            {editingRevenue ? (
              <div className="flex gap-1">
                <Input
                  className="h-5 w-20 text-xs px-1 tabular-nums"
                  value={revenueInput}
                  onChange={(e) => setRevenueInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveRevenue(); if (e.key === "Escape") setEditingRevenue(false); }}
                  autoFocus
                />
                <Button variant="ghost" size="sm" className="h-5 px-1 text-xs" onClick={saveRevenue}>✓</Button>
              </div>
            ) : (
              <p
                className="font-medium tabular-nums cursor-pointer hover:text-primary"
                title="Clica para editar"
                onClick={() => setEditingRevenue(true)}
              >
                {formatMoney(revenue, currency)}
              </p>
            )}
          </div>
          <div>
            <p className="text-muted-foreground">ROI</p>
            <p className={`font-semibold tabular-nums ${roi >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {roi >= 0 ? "+" : ""}{formatMoney(roi, currency)}
            </p>
          </div>
        </div>

        {/* Shipments summary + add button */}
        <div className="flex items-center justify-between">
          {influencer.shipments.length > 0 ? (
            <p className="text-[10px] text-muted-foreground">
              {influencer.shipments.length} envio(s) · último: {influencer.shipments[influencer.shipments.length - 1]?.status}
            </p>
          ) : (
            <span className="text-[10px] text-muted-foreground">Sem envios</span>
          )}
          <ShipmentAddDialog
            influencerId={influencer.id}
            influencerName={influencer.name}
            products={products}
          />
        </div>
      </CardContent>
    </Card>
  );
}

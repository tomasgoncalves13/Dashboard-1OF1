import { prisma } from "@/lib/prisma";
import { getAdAccountInsightsDaily } from "@/lib/meta/graph";
import { getAdAccountInsightsDaily as getGoogleAdAccountInsightsDaily } from "@/lib/google-ads/client";
import { ymd } from "@/lib/dashboard/range";

// Plano Q4 2026 (Out 2026 → Jan 2027). Mesmo modelo do simulador em
// https://claude.ai/artifact/Dq1WuXHPqd5PhgR69oCuu6 e de "Facebook Ads/01 - Estrategia e Analise.md":
// custo por encomenda = €16 × (budget/€48)^0,35 × fator da fase × 0,8.
// €16 a €48/dia = real dos 14 dias de teste (9–22 Set 2026); × 0,8 = criativos novos 20% melhores.

type Phase = { id: string; nome: string; from: string; to: string; f: number; aov: number; m: number };

export const Q4_PHASES: Phase[] = [
  { id: "out", nome: "Escalar a época", from: "2026-10-01", to: "2026-10-31", f: 1.0, aov: 44, m: 0.73 },
  { id: "prebf", nome: "Aquecimento BF", from: "2026-11-01", to: "2026-11-19", f: 1.1, aov: 44, m: 0.73 },
  { id: "bw", nome: "Black Week", from: "2026-11-20", to: "2026-12-01", f: 0.8, aov: 48, m: 0.7 },
  { id: "natal", nome: "Natal", from: "2026-12-02", to: "2026-12-18", f: 0.9, aov: 46, m: 0.7 },
  { id: "pos", nome: "Natal → Ano Novo", from: "2026-12-19", to: "2027-01-01", f: 1.3, aov: 44, m: 0.73 },
  { id: "saldos", nome: "Saldos + 2.ª volta", from: "2027-01-02", to: "2027-01-31", f: 1.0, aov: 42, m: 0.72 },
];

const BASE_BUDGETS: Record<string, number> = { out: 80, prebf: 120, bw: 300, natal: 200, pos: 60, saldos: 120 };

// Dias fortes dentro de uma fase (a média da fase mantém-se).
const SPECIAL: Record<string, number> = {
  "2026-11-26": 1.3, "2026-11-27": 2.6, "2026-11-28": 1.5, "2026-11-29": 1.3, "2026-11-30": 1.9,
  "2027-01-02": 1.4, "2027-01-03": 1.3, "2027-01-04": 1.2,
};

/** Regra de decisão para a Black Week, medida a €80-100/dia em outubro. */
export const FULL_GAS_MAX_CPO = 14;
export const CONSERVATIVE_MIN_CPO = 18;

const DAY = 86_400_000;
const utc = (s: string) => new Date(`${s}T00:00:00Z`);

function costPerOrder(p: Phase, budget: number) {
  return 16 * Math.pow(Math.max(budget, 1) / 48, 0.35) * p.f * 0.8;
}

type Totals = { spend: number; orders: number; revenue: number };
const zero = (): Totals => ({ spend: 0, orders: 0, revenue: 0 });

/** Plano diário do cenário otimista-realista. */
function planDaily(): { date: string; phaseId: string; spend: number; orders: number; revenue: number }[] {
  const out: { date: string; phaseId: string; spend: number; orders: number; revenue: number }[] = [];
  for (const p of Q4_PHASES) {
    const start = utc(p.from).getTime();
    const n = Math.round((utc(p.to).getTime() - start) / DAY) + 1;
    const weights = Array.from({ length: n }, (_, i) =>
      p.id === "natal" ? 0.8 + 0.6 * Math.min(1, i / (n - 4)) : SPECIAL[ymd(new Date(start + i * DAY))] ?? 1,
    );
    const mean = weights.reduce((s, w) => s + w, 0) / n;
    const budget = BASE_BUDGETS[p.id];
    const cpo = costPerOrder(p, budget);
    weights.forEach((w, i) => {
      const spend = (budget * w) / mean;
      const orders = spend / cpo;
      out.push({ date: ymd(new Date(start + i * DAY)), phaseId: p.id, spend, orders, revenue: orders * p.aov });
    });
  }
  return out;
}

export type Q4PhaseRow = {
  id: string;
  nome: string;
  from: string;
  to: string;
  status: "future" | "current" | "done";
  planFull: Totals;
  planToDate: Totals;
  real: Totals;
};

export type Q4Tracking = {
  last7: Totals & { costPerOrder: number | null };
  verdict: "full" | "base" | "cons" | null;
  phases: Q4PhaseRow[];
};

export async function getQ4Tracking(storeId: string, now = new Date()): Promise<Q4Tracking> {
  const today = ymd(now);
  const since = ymd(new Date(Math.min(now.getTime() - 7 * DAY, utc(Q4_PHASES[0].from).getTime())));
  const until = today < Q4_PHASES[Q4_PHASES.length - 1].to ? today : Q4_PHASES[Q4_PHASES.length - 1].to;

  const [orders, meta, google] = await Promise.all([
    prisma.order.findMany({
      where: { storeId, financialStatus: "PAID", processedAt: { gte: utc(since) } },
      select: { processedAt: true, total: true },
    }),
    getAdAccountInsightsDaily(since, until).catch(() => []),
    getGoogleAdAccountInsightsDaily(since, until).catch(() => []),
  ]);

  const real = new Map<string, Totals>();
  const at = (d: string) => real.get(d) ?? (real.set(d, zero()), real.get(d)!);
  for (const o of orders) {
    const t = at(ymd(o.processedAt));
    t.orders += 1;
    t.revenue += Number(o.total);
  }
  for (const r of meta) at(r.date_start).spend += Number(r.spend ?? 0);
  for (const r of google) if (r.date) at(r.date).spend += Number(r.spend ?? 0);

  // Últimos 7 dias completos (sem hoje, que ainda vai a meio).
  const last7 = zero();
  for (let i = 1; i <= 7; i++) {
    const t = real.get(ymd(new Date(now.getTime() - i * DAY)));
    if (t) (last7.spend += t.spend), (last7.orders += t.orders), (last7.revenue += t.revenue);
  }
  const cpo = last7.orders > 0 ? last7.spend / last7.orders : null;
  const verdict = cpo === null ? null : cpo <= FULL_GAS_MAX_CPO ? "full" : cpo > CONSERVATIVE_MIN_CPO ? "cons" : "base";

  const plan = planDaily();
  const phases = Q4_PHASES.map((p): Q4PhaseRow => {
    const planFull = zero();
    const planToDate = zero();
    const realT = zero();
    for (const d of plan.filter((x) => x.phaseId === p.id)) {
      planFull.spend += d.spend; planFull.orders += d.orders; planFull.revenue += d.revenue;
      if (d.date <= today) {
        planToDate.spend += d.spend; planToDate.orders += d.orders; planToDate.revenue += d.revenue;
        const r = real.get(d.date);
        if (r) (realT.spend += r.spend), (realT.orders += r.orders), (realT.revenue += r.revenue);
      }
    }
    const status = today < p.from ? "future" : today > p.to ? "done" : "current";
    return { id: p.id, nome: p.nome, from: p.from, to: p.to, status, planFull, planToDate, real: realT };
  });

  return { last7: { ...last7, costPerOrder: cpo }, verdict, phases };
}

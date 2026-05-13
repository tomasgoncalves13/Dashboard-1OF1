// Date-range parsing for the dashboard. Reads URL searchParams and returns a
// `{ from, to, preset, label }` window. Capped at 365 days.

export type RangePreset = "today" | "yesterday" | "7d" | "30d" | "90d" | "365d" | "custom";

export type DateRange = {
  from: Date;
  to: Date;
  preset: RangePreset;
  label: string;
};

const PRESET_LABELS: Record<Exclude<RangePreset, "custom">, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  "365d": "Últimos 365 dias",
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function resolveRange(searchParams: Record<string, string | string[] | undefined>): DateRange {
  const preset = (asString(searchParams.range) as RangePreset | undefined) ?? "30d";
  const now = new Date();

  if (preset === "today") {
    return { preset, from: startOfDay(now), to: endOfDay(now), label: PRESET_LABELS.today };
  }
  if (preset === "yesterday") {
    const y = new Date(now); y.setDate(now.getDate() - 1);
    return { preset, from: startOfDay(y), to: endOfDay(y), label: PRESET_LABELS.yesterday };
  }
  if (preset === "7d" || preset === "30d" || preset === "90d" || preset === "365d") {
    const days = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 }[preset];
    const from = new Date(now); from.setDate(now.getDate() - (days - 1));
    return { preset, from: startOfDay(from), to: endOfDay(now), label: PRESET_LABELS[preset] };
  }

  // custom
  const fromStr = asString(searchParams.from);
  const toStr = asString(searchParams.to);
  const fromD = fromStr ? new Date(fromStr) : new Date(now.getTime() - 29 * 86400000);
  const toD = toStr ? new Date(toStr) : now;
  const clampedFrom = clampMaxRange(fromD, toD);
  return {
    preset: "custom",
    from: startOfDay(clampedFrom),
    to: endOfDay(toD),
    label: `${ymd(clampedFrom)} → ${ymd(toD)}`,
  };
}

function asString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function clampMaxRange(from: Date, to: Date): Date {
  const max = 365 * 86400000;
  if (to.getTime() - from.getTime() > max) {
    return new Date(to.getTime() - max);
  }
  return from;
}

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

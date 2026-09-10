"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

interface DaySpend {
  date: string;
  spend: number;
  revenue: number;
}

function fmt(v: number) {
  return `€${v.toFixed(2)}`;
}

const LABELS: Record<string, string> = {
  revenue: "Ganho",
  spend: "Gasto",
};

export function SpendChart({ data }: { data: DaySpend[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => {
            const d = new Date(v);
            return `${d.getDate()}/${d.getMonth() + 1}`;
          }}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} width={48} />
        <Tooltip
          formatter={(v: number, name: string) => [fmt(v), LABELS[name] ?? name]}
          labelFormatter={(l) => {
            const d = new Date(l);
            return d.toLocaleDateString("pt-PT");
          }}
        />
        <Legend formatter={(name) => LABELS[name] ?? name} />
        <Bar dataKey="revenue" name="revenue" fill="#22c55e" radius={[3, 3, 0, 0]} />
        <Bar dataKey="spend" name="spend" fill="#ef4444" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

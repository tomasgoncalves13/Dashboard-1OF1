"use client";

import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

interface MonthData {
  month: string;
  cashIn: number;
  cashOut: number;
  net: number;
}

function fmt(v: number) {
  return `€${v.toFixed(0)}`;
}

function monthLabel(month: string) {
  const [yyyy, mm] = month.split("-");
  const label = new Date(Number(yyyy), Number(mm) - 1).toLocaleString("pt-PT", { month: "short" });
  return label.charAt(0).toUpperCase() + label.slice(1).replace(".", "");
}

export function CashflowChart({ data }: { data: MonthData[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>;

  const chartData = data.map((m) => ({ ...m, label: monthLabel(m.month) }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="cashInGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.55} />
          </linearGradient>
          <linearGradient id="cashOutGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f87171" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#f87171" stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} width={52} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))" }}
          formatter={(v: number, name: string) => [fmt(v), name]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
        <Bar dataKey="cashIn" name="Cash in" fill="url(#cashInGradient)" radius={[6, 6, 0, 0]} maxBarSize={28} />
        <Bar dataKey="cashOut" name="Cash out" fill="url(#cashOutGradient)" radius={[6, 6, 0, 0]} maxBarSize={28} />
        <Line
          type="monotone"
          dataKey="net"
          name="Net"
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          dot={{ r: 3, strokeWidth: 0, fill: "hsl(var(--primary))" }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

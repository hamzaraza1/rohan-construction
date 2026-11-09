"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/format";

// Palette validated (lightness, chroma, CVD separation, contrast) for a light surface.
const IN = "#2563eb";
const OUT = "#d97706";

const compact = (v: number) =>
  v >= 10_000_000 ? `${(v / 10_000_000).toFixed(1)} Cr` : v >= 100_000 ? `${(v / 100_000).toFixed(1)} L` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v);

export function CashFlowChart({ data }: { data: { month: string; inflow: number; outflow: number; withdrawals: number }[] }) {
  if (data.every((d) => d.inflow === 0 && d.outflow === 0)) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
        No cash movements in the last 12 months.
      </div>
    );
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: "#cbd5e1" }} tick={{ fontSize: 12, fill: "#64748b" }} />
          <YAxis tickFormatter={compact} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} width={52} />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            formatter={(value, name) => [formatMoney(Number(value)), name]}
            contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 13 }}
            labelStyle={{ color: "#0f172a", fontWeight: 600 }}
          />
          <Legend iconType="square" wrapperStyle={{ fontSize: 13, color: "#475569" }} />
          <Bar dataKey="inflow" name="Client receipts" fill={IN} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="outflow" name="Construction payments" fill={OUT} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

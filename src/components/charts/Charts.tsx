"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, formatMoneyShort, formatMonth } from "@/lib/format";

// Categorical slots (validated order): blue, orange, aqua.
const S1 = "#2a78d6";
const S2 = "#eb6834";
const S3 = "#1baf7a";
const GRID = "#e2e8f0";
const AXIS = { fontSize: 12, fill: "#64748b" };

function axisMoney(v: number) {
  return formatMoneyShort(v).replace("Rs. ", "");
}

function TooltipBox({ active, payload, label, labelFormat }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; labelFormat?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-slate-900">{labelFormat ? labelFormat(String(label)) : label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-slate-600">
          <span className="size-2 rounded-sm" style={{ background: p.color }} />
          <span className="flex-1">{p.name}</span>
          <span className="tabular font-medium text-slate-900">{formatMoney(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

const legendStyle = { fontSize: 12, color: "#334155", paddingTop: 8 };
// Legend text stays in text ink; the swatch carries the series colour.
const legendText = (value: string) => <span style={{ color: "#334155" }}>{value}</span>;

export function CashFlowChart({ data, height = 280 }: { data: { month: string; inflow: number; outflow: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="month" tickFormatter={formatMonth} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={axisMoney} tick={AXIS} axisLine={false} tickLine={false} width={56} />
        <Tooltip cursor={{ fill: "#f1f5f9" }} content={<TooltipBox labelFormat={formatMonth} />} />
        <Legend wrapperStyle={legendStyle} iconType="square" iconSize={10} formatter={legendText} />
        <Bar name="Received from clients" dataKey="inflow" fill={S1} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar name="Paid out (suppliers, contractors, expenses)" dataKey="outflow" fill={S2} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CostBreakdownChart({ data, height }: { data: { name: string; material: number; contractor: number; expenses: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(200, data.length * 46 + 60)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tickFormatter={axisMoney} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={150} />
        <Tooltip cursor={{ fill: "#f1f5f9" }} content={<TooltipBox />} />
        <Legend wrapperStyle={legendStyle} iconType="square" iconSize={10} formatter={legendText} />
        <Bar name="Supplier payments" dataKey="material" stackId="a" fill={S1} stroke="#fff" strokeWidth={2} maxBarSize={22} />
        <Bar name="Contractor payments" dataKey="contractor" stackId="a" fill={S2} stroke="#fff" strokeWidth={2} maxBarSize={22} />
        <Bar name="Site expenses" dataKey="expenses" stackId="a" fill={S3} stroke="#fff" strokeWidth={2} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryBarChart({ data, height, name = "Amount" }: { data: { name: string; value: number }[]; height?: number; name?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(180, data.length * 34 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tickFormatter={axisMoney} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={170} />
        <Tooltip cursor={{ fill: "#f1f5f9" }} content={<TooltipBox />} />
        <Bar name={name} dataKey="value" fill={S1} radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

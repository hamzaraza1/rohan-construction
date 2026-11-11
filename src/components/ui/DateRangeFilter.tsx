"use client";

import { DEMO_TODAY } from "@/lib/mock-data";
import { FilterSelect } from "./DataTable";

export type DatePreset = "all" | "this_month" | "last_month" | "last_30" | "last_90" | "this_year" | "custom";
export interface DateRange {
  preset: DatePreset;
  from?: string;
  to?: string;
}

export const ALL_TIME: DateRange = { preset: "all" };

const shift = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function resolveRange(r: DateRange): { from?: string; to?: string } {
  const today = DEMO_TODAY;
  switch (r.preset) {
    case "all":
      return {};
    case "this_month":
      return { from: today.slice(0, 8) + "01", to: today };
    case "last_month": {
      const first = new Date(today.slice(0, 8) + "01T00:00:00Z");
      first.setUTCMonth(first.getUTCMonth() - 1);
      const from = first.toISOString().slice(0, 10);
      return { from, to: shift(today.slice(0, 8) + "01", -1) };
    }
    case "last_30":
      return { from: shift(today, -29), to: today };
    case "last_90":
      return { from: shift(today, -89), to: today };
    case "this_year":
      return { from: today.slice(0, 4) + "-01-01", to: today };
    case "custom":
      return { from: r.from || undefined, to: r.to || undefined };
  }
}

export function inRange(date: string, r: DateRange) {
  const { from, to } = resolveRange(r);
  return (!from || date >= from) && (!to || date <= to);
}

export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect label="Date range" value={value.preset} onChange={(v) => onChange({ ...value, preset: v as DatePreset })}>
        <option value="all">All dates</option>
        <option value="this_month">This month</option>
        <option value="last_month">Last month</option>
        <option value="last_30">Last 30 days</option>
        <option value="last_90">Last 90 days</option>
        <option value="this_year">This year</option>
        <option value="custom">Custom range…</option>
      </FilterSelect>
      {value.preset === "custom" && (
        <>
          <input type="date" aria-label="From date" value={value.from ?? ""} max={value.to || DEMO_TODAY} onChange={(e) => onChange({ ...value, from: e.target.value })} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm" />
          <span className="text-sm text-slate-400">to</span>
          <input type="date" aria-label="To date" value={value.to ?? ""} min={value.from} max={DEMO_TODAY} onChange={(e) => onChange({ ...value, to: e.target.value })} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm" />
        </>
      )}
    </div>
  );
}

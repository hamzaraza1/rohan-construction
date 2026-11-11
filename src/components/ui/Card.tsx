import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm", className)}>{children}</section>;
}

export function CardHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "default" | "positive" | "negative" | "warning" | "brand";

const toneValue: Record<Tone, string> = {
  default: "text-slate-900",
  brand: "text-brand-800",
  positive: "text-emerald-700",
  negative: "text-red-700",
  warning: "text-amber-700",
};
const toneIcon: Record<Tone, string> = {
  default: "bg-slate-100 text-slate-600",
  brand: "bg-brand-50 text-brand-700",
  positive: "bg-emerald-50 text-emerald-700",
  negative: "bg-red-50 text-red-700",
  warning: "bg-amber-50 text-amber-700",
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-slate-500 sm:text-sm">{label}</p>
        {icon && <span className={cn("hidden size-9 shrink-0 sm:flex items-center justify-center rounded-lg", toneIcon[tone])}>{icon}</span>}
      </div>
      <p className={cn("tabular mt-1 truncate text-lg font-semibold tracking-tight sm:text-2xl", toneValue[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Label/value rows for detail panels. */
export function DetailList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-slate-100">
      {items.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-4 px-5 py-2.5 text-sm">
          <dt className="shrink-0 text-slate-500">{k}</dt>
          <dd className="min-w-0 text-right font-medium break-words text-slate-900">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

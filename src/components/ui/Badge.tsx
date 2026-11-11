import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { ContractStatus, ProjectStatus } from "@/lib/types";
import { CONTRACT_STATUS_LABELS, PROJECT_STATUS_LABELS } from "@/lib/format";

export type BadgeTone = "slate" | "green" | "blue" | "amber" | "red" | "violet";

const tones: Record<BadgeTone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  blue: "bg-blue-50 text-blue-800 ring-blue-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  violet: "bg-violet-50 text-violet-800 ring-violet-200",
};

export function Badge({ tone = "slate", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}

const projectTone: Record<ProjectStatus, BadgeTone> = { ACTIVE: "green", PLANNING: "blue", ON_HOLD: "amber", COMPLETED: "slate" };
export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge tone={projectTone[status]}>
      <span className={cn("size-1.5 rounded-full", { ACTIVE: "bg-emerald-500", PLANNING: "bg-blue-500", ON_HOLD: "bg-amber-500", COMPLETED: "bg-slate-400" }[status])} />
      {PROJECT_STATUS_LABELS[status]}
    </Badge>
  );
}

const contractTone: Record<ContractStatus, BadgeTone> = { ACTIVE: "blue", COMPLETED: "green", TERMINATED: "red" };
export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return <Badge tone={contractTone[status]}>{CONTRACT_STATUS_LABELS[status]}</Badge>;
}

export function ProgressBar({ value, className, showLabel = true }: { value: number; className?: string; showLabel?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full", v >= 100 ? "bg-emerald-500" : "bg-accent-500")} style={{ width: `${v}%` }} />
      </div>
      {showLabel && <span className="tabular w-9 shrink-0 text-right text-xs font-medium text-slate-600">{v}%</span>}
    </div>
  );
}

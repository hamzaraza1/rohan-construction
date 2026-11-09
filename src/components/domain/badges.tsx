import { Badge } from "@/components/ui/Badge";
import { PROJECT_STATUS_LABELS, PROJECT_TYPE_LABELS } from "@/lib/format";

const STATUS_TONE = { ACTIVE: "green", PLANNING: "blue", ON_HOLD: "amber", COMPLETED: "slate", CANCELLED: "red" } as const;
const TYPE_TONE = { WITH_MATERIAL: "blue", LABOUR_RATE: "amber", COMMISSION: "violet" } as const;

export function ProjectStatusBadge({ status }: { status: keyof typeof PROJECT_STATUS_LABELS }) {
  return <Badge tone={STATUS_TONE[status]}>{PROJECT_STATUS_LABELS[status]}</Badge>;
}

export function ProjectTypeBadge({ type, commission }: { type: keyof typeof PROJECT_TYPE_LABELS; commission?: { toString(): string } | null }) {
  return (
    <Badge tone={TYPE_TONE[type]}>
      {PROJECT_TYPE_LABELS[type]}
      {type === "COMMISSION" && commission != null ? ` · ${commission.toString()}%` : ""}
    </Badge>
  );
}

import { Construction } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

/** Honest placeholder for modules scheduled for a later phase — shows no fake data. */
export function PlannedModule({ title, phase, items }: { title: string; phase: number; items: string[] }) {
  return (
    <>
      <PageHeader title={title} />
      <Card className="p-8">
        <div className="flex items-start gap-4">
          <span className="rounded-lg bg-amber-50 p-2.5 text-amber-700"><Construction className="size-6" /></span>
          <div>
            <h2 className="font-semibold text-slate-900">Scheduled for Phase {phase}</h2>
            <p className="mt-1 text-sm text-slate-600">
              The database tables, constraints and ledger rules for this module already exist. The screens will be delivered in Phase {phase}:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {items.map((i) => <li key={i}>{i}</li>)}
            </ul>
          </div>
        </div>
      </Card>
    </>
  );
}

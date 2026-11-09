"use client";
import Link from "next/link";
import type { ActionResult } from "@/lib/mutation";
import { ActionForm } from "@/components/ui/ActionForm";
import { FormField } from "@/components/ui/FormField";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ButtonLink } from "@/components/ui/Button";

export type ContractValues = {
  contractorId: string;
  title: string;
  description: string;
  contractAmount: string;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "COMPLETED" | "TERMINATED";
  progressPercent: string;
  scope: Record<string, "included" | "excluded">;
};

export function ContractForm({
  action,
  initial,
  contractors,
  workCategories,
  cancelHref,
  submitLabel,
  newContractorHref,
  contractorLocked,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  initial: ContractValues;
  contractors: { id: string; name: string; specialization: string | null }[];
  workCategories: { id: string; name: string; isActive: boolean }[];
  cancelHref: string;
  submitLabel: string;
  newContractorHref?: string;
  contractorLocked?: boolean;
}) {
  // Inactive categories only appear if this contract already uses them.
  const cats = workCategories.filter((c) => c.isActive || initial.scope[c.id]);
  return (
    <ActionForm action={action} className="grid gap-5 sm:grid-cols-2">
      <FormField
        label="Contractor"
        name="contractorId"
        required
        hint={contractorLocked ? "Locked: payments are already recorded on this contract." : undefined}
      >
        <div className="flex gap-2">
          <Select id="contractorId" name="contractorId" defaultValue={initial.contractorId} required className="flex-1">
            <option value="">Select a contractor…</option>
            {contractors.map((c) => (
              <option key={c.id} value={c.id} disabled={contractorLocked && c.id !== initial.contractorId}>
                {c.name}{c.specialization ? ` — ${c.specialization}` : ""}
              </option>
            ))}
          </Select>
          {newContractorHref && !contractorLocked && (
            <Link href={newContractorHref} className="shrink-0 self-center text-sm font-medium text-brand-700 hover:underline">+ New</Link>
          )}
        </div>
      </FormField>
      <FormField label="Contract title" name="title" required>
        <Input id="title" name="title" defaultValue={initial.title} required maxLength={200} placeholder="e.g. Complete labour contract — grey structure" />
      </FormField>
      <FormField
        label="Agreed contract amount (Rs.)"
        name="contractAmount"
        required
        hint="A commitment — it does not reduce cash. Only actual payments do."
      >
        <Input id="contractAmount" name="contractAmount" inputMode="decimal" defaultValue={initial.contractAmount} required placeholder="e.g. 2,500,000" />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Status" name="status" required>
          <Select id="status" name="status" defaultValue={initial.status}>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="TERMINATED">Terminated</option>
          </Select>
        </FormField>
        <FormField label="Work progress %" name="progressPercent" required>
          <Input id="progressPercent" name="progressPercent" type="number" min={0} max={100} step={1} defaultValue={initial.progressPercent} required />
        </FormField>
      </div>
      <FormField label="Start date" name="startDate" required>
        <Input id="startDate" name="startDate" type="date" defaultValue={initial.startDate} required />
      </FormField>
      <FormField label="Expected end date (optional)" name="endDate">
        <Input id="endDate" name="endDate" type="date" defaultValue={initial.endDate} />
      </FormField>
      <FormField label="Description / terms" name="description" className="sm:col-span-2">
        <Textarea id="description" name="description" defaultValue={initial.description} rows={3} placeholder="Payment terms, rates, special conditions…" />
      </FormField>

      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium text-slate-700">Work scope</legend>
        <p className="mb-3 text-xs text-slate-500">
          Mark each work category as included in or excluded from this contract. Leave as &ldquo;Not specified&rdquo; if it does not apply.
          Categories are managed in Settings → Work categories.
        </p>
        {cats.length === 0 ? (
          <p className="text-sm text-slate-500">No work categories configured.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cats.map((c) => (
              <label key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-sm text-slate-800">{c.name}</span>
                <select
                  name={`scope:${c.id}`}
                  defaultValue={initial.scope[c.id] ?? ""}
                  aria-label={`${c.name} scope`}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                >
                  <option value="">Not specified</option>
                  <option value="included">Included</option>
                  <option value="excluded">Excluded</option>
                </select>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex gap-2 sm:col-span-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        <ButtonLink href={cancelHref} variant="secondary">Cancel</ButtonLink>
      </div>
    </ActionForm>
  );
}

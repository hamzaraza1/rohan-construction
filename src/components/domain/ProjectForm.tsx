"use client";
import Link from "next/link";
import { useState } from "react";
import type { ActionResult } from "@/lib/mutation";
import { ActionForm } from "@/components/ui/ActionForm";
import { FormField } from "@/components/ui/FormField";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { useActionFormState } from "@/components/ui/ActionForm";

type ProjectType = "WITH_MATERIAL" | "LABOUR_RATE" | "COMMISSION";

export type ProjectValues = {
  name: string;
  clientId: string;
  siteAddress: string;
  type: ProjectType;
  status: string;
  startDate: string;
  expectedCompletionDate: string;
  description: string;
  commissionPercent: string;
  clientContractAmount: string;
};

const TYPES: { value: ProjectType; title: string; text: string }[] = [
  {
    value: "WITH_MATERIAL",
    title: "With Material",
    text: "We buy materials, hire labour and contractors, and run the complete construction.",
  },
  {
    value: "LABOUR_RATE",
    title: "Labour Rate",
    text: "The client buys materials. We provide and manage labour at agreed rates.",
  },
  {
    value: "COMMISSION",
    title: "Commission Based",
    text: "We manage the project; actual costs are tracked and we charge a commission % on them.",
  },
];

function TypeError() {
  const { fieldErrors } = useActionFormState();
  const msg = fieldErrors?.type?.[0];
  return msg ? <p className="mt-1 text-xs text-red-600">{msg}</p> : null;
}

export function ProjectForm({
  action,
  initial,
  clients,
  cancelHref,
  submitLabel,
  clientLocked,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  initial: ProjectValues;
  clients: { id: string; name: string; phone: string }[];
  cancelHref: string;
  submitLabel: string;
  clientLocked?: boolean;
}) {
  const [type, setType] = useState<ProjectType>(initial.type);
  return (
    <ActionForm action={action} className="grid gap-5 sm:grid-cols-2">
      <FormField label="Project name" name="name" required>
        <Input id="name" name="name" defaultValue={initial.name} required maxLength={150} placeholder="e.g. Site A — DHA Phase 6 House" />
      </FormField>
      <FormField
        label="Client"
        name="clientId"
        required
        hint={clientLocked ? "Locked: client payments are already recorded for this project." : undefined}
      >
        <div className="flex gap-2">
          <Select id="clientId" name="clientId" defaultValue={initial.clientId} required className="flex-1">
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id} disabled={clientLocked && c.id !== initial.clientId}>
                {c.name} ({c.phone})
              </option>
            ))}
          </Select>
          {!clientLocked && (
            <Link href="/clients/new?returnTo=project" className="shrink-0 self-center text-sm font-medium text-brand-700 hover:underline">
              + New
            </Link>
          )}
        </div>
      </FormField>
      <FormField label="Site address / location" name="siteAddress" required className="sm:col-span-2">
        <Input id="siteAddress" name="siteAddress" defaultValue={initial.siteAddress} required maxLength={300} />
      </FormField>

      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-sm font-medium text-slate-700">
          Contract type<span className="ml-0.5 text-red-600">*</span>
        </legend>
        <div className="grid gap-3 md:grid-cols-3">
          {TYPES.map((t) => (
            <label
              key={t.value}
              className={cn(
                "cursor-pointer rounded-xl border p-4 transition-colors",
                type === t.value ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-slate-200 hover:border-slate-300",
              )}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="type"
                  value={t.value}
                  checked={type === t.value}
                  onChange={() => setType(t.value)}
                  className="size-4 accent-brand-700"
                />
                <span className="font-medium text-slate-900">{t.title}</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600">{t.text}</p>
            </label>
          ))}
        </div>
        <TypeError />
      </fieldset>

      {type === "COMMISSION" ? (
        <FormField
          label="Commission percentage"
          name="commissionPercent"
          required
          hint="Charged on the total actual project cost (materials received + contractor payments + expenses). Set separately for every project."
        >
          <div className="relative">
            <Input id="commissionPercent" name="commissionPercent" inputMode="decimal" defaultValue={initial.commissionPercent} required className="pr-8" placeholder="10" />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">%</span>
          </div>
        </FormField>
      ) : (
        <FormField
          label="Agreed contract value with client (optional)"
          name="clientContractAmount"
          hint="If entered, the project shows how much the client still has to pay."
        >
          <Input id="clientContractAmount" name="clientContractAmount" inputMode="decimal" defaultValue={initial.clientContractAmount} placeholder="Rs." />
        </FormField>
      )}
      <FormField label="Status" name="status" required>
        <Select id="status" name="status" defaultValue={initial.status}>
          <option value="PLANNING">Planning</option>
          <option value="ACTIVE">Active</option>
          <option value="ON_HOLD">On Hold</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </FormField>
      <FormField label="Start date" name="startDate" required>
        <Input id="startDate" name="startDate" type="date" defaultValue={initial.startDate} required />
      </FormField>
      <FormField label="Expected completion (optional)" name="expectedCompletionDate">
        <Input id="expectedCompletionDate" name="expectedCompletionDate" type="date" defaultValue={initial.expectedCompletionDate} />
      </FormField>
      <FormField label="Project description" name="description" className="sm:col-span-2">
        <Textarea id="description" name="description" defaultValue={initial.description} rows={3} />
      </FormField>
      <div className="flex gap-2 sm:col-span-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        <ButtonLink href={cancelHref} variant="secondary">Cancel</ButtonLink>
      </div>
    </ActionForm>
  );
}

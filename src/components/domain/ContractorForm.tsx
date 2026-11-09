"use client";
import type { ActionResult } from "@/lib/mutation";
import { ActionForm } from "@/components/ui/ActionForm";
import { FormField } from "@/components/ui/FormField";
import { Input, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ButtonLink } from "@/components/ui/Button";

type Values = { name: string; phone: string; address: string | null; specialization: string | null; notes: string | null };

export function ContractorForm({
  action,
  initial,
  cancelHref,
  submitLabel,
  returnTo,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  initial?: Values;
  cancelHref: string;
  submitLabel: string;
  returnTo?: string;
}) {
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <FormField label="Contractor name" name="name" required>
        <Input id="name" name="name" defaultValue={initial?.name} required maxLength={150} />
      </FormField>
      <FormField label="Phone number" name="phone" required>
        <Input id="phone" name="phone" type="tel" defaultValue={initial?.phone} required placeholder="0300-1234567" />
      </FormField>
      <FormField label="Work specialization" name="specialization" hint="e.g. Grey structure, Electrician, Tile fixer">
        <Input id="specialization" name="specialization" defaultValue={initial?.specialization ?? ""} />
      </FormField>
      <FormField label="Address" name="address">
        <Input id="address" name="address" defaultValue={initial?.address ?? ""} />
      </FormField>
      <FormField label="Notes" name="notes" className="sm:col-span-2">
        <Textarea id="notes" name="notes" defaultValue={initial?.notes ?? ""} />
      </FormField>
      <div className="flex gap-2 sm:col-span-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        <ButtonLink href={cancelHref} variant="secondary">Cancel</ButtonLink>
      </div>
    </ActionForm>
  );
}

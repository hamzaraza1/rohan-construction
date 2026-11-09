"use client";
import type { ActionResult } from "@/lib/mutation";
import { ActionForm } from "@/components/ui/ActionForm";
import { FormField } from "@/components/ui/FormField";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ButtonLink } from "@/components/ui/Button";

export type PaymentValues = {
  amount: string;
  date: string;
  method: "CASH" | "BANK_TRANSFER";
  reference: string;
  description: string;
  attachment?: { id: string; originalName: string } | null;
};

export function PaymentForm({
  action,
  initial,
  maxDate,
  cancelHref,
  submitLabel,
  leading,
  trailing,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  initial: PaymentValues;
  maxDate: string;
  cancelHref: string;
  submitLabel: string;
  /** Extra fields rendered before / after the standard payment fields. */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      {leading}
      <FormField label="Amount (Rs.)" name="amount" required>
        <Input id="amount" name="amount" inputMode="decimal" defaultValue={initial.amount} required placeholder="e.g. 500000" autoComplete="off" />
      </FormField>
      <FormField label="Payment date" name="date" required>
        <Input id="date" name="date" type="date" defaultValue={initial.date} max={maxDate} required />
      </FormField>
      <FormField label="Payment method" name="method" required>
        <Select id="method" name="method" defaultValue={initial.method}>
          <option value="CASH">Cash</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
        </Select>
      </FormField>
      <FormField label="Reference number (optional)" name="reference" hint="Cheque / transaction / slip number">
        <Input id="reference" name="reference" defaultValue={initial.reference} maxLength={100} />
      </FormField>
      <FormField label="Description" name="description" className="sm:col-span-2">
        <Textarea id="description" name="description" defaultValue={initial.description} rows={2} placeholder="e.g. 2nd installment — grey structure" />
      </FormField>
      <FormField label="Receipt attachment (optional)" name="attachment" hint="PDF, JPG, PNG or WEBP — up to 10 MB" className="sm:col-span-2">
        {initial.attachment && (
          <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
            <a href={`/api/attachments/${initial.attachment.id}`} target="_blank" rel="noopener" className="font-medium text-brand-700 hover:underline">
              {initial.attachment.originalName}
            </a>
            <label className="flex items-center gap-1.5 text-slate-600">
              <input type="checkbox" name="removeAttachment" className="size-4 rounded border-slate-300" /> Remove
            </label>
            <span className="text-xs text-slate-500">or choose a file below to replace it</span>
          </div>
        )}
        <Input id="attachment" name="attachment" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm" />
      </FormField>
      {trailing}
      <div className="flex gap-2 sm:col-span-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        <ButtonLink href={cancelHref} variant="secondary">Cancel</ButtonLink>
      </div>
    </ActionForm>
  );
}

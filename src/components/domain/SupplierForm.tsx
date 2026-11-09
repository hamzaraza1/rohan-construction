"use client";
import type { ActionResult } from "@/lib/mutation";
import { ActionForm } from "@/components/ui/ActionForm";
import { FormField } from "@/components/ui/FormField";
import { Input, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ButtonLink } from "@/components/ui/Button";

type Values = { name: string; phone: string; address: string | null; notes: string | null; categoryIds: string[] };

export function SupplierForm({
  action,
  initial,
  categories,
  cancelHref,
  submitLabel,
  returnTo,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  initial?: Values;
  categories: { id: string; name: string; isActive: boolean }[];
  cancelHref: string;
  submitLabel: string;
  returnTo?: string;
}) {
  const visible = categories.filter((c) => c.isActive || initial?.categoryIds.includes(c.id));
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <FormField label="Supplier name" name="name" required>
        <Input id="name" name="name" defaultValue={initial?.name} required maxLength={150} />
      </FormField>
      <FormField label="Contact number" name="phone" required>
        <Input id="phone" name="phone" type="tel" defaultValue={initial?.phone} required placeholder="042-1234567" />
      </FormField>
      <FormField label="Address" name="address" className="sm:col-span-2">
        <Input id="address" name="address" defaultValue={initial?.address ?? ""} />
      </FormField>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-sm font-medium text-slate-700">Material categories supplied</legend>
        <div className="flex flex-wrap gap-2">
          {visible.map((c) => (
            <label key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={initial?.categoryIds.includes(c.id)} className="size-4 accent-brand-700" />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>
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

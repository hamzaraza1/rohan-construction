"use client";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Field";

export function PaymentTypeField({ defaultValue }: { defaultValue: "ADVANCE" | "INSTALLMENT" | "FINAL" }) {
  return (
    <FormField label="Payment type" name="type" required className="sm:col-span-2">
      <Select id="type" name="type" defaultValue={defaultValue}>
        <option value="ADVANCE">Advance</option>
        <option value="INSTALLMENT">Installment</option>
        <option value="FINAL">Final payment</option>
      </Select>
    </FormField>
  );
}

export function OverpayField() {
  return (
    <label className="flex items-start gap-2 text-sm text-slate-700 sm:col-span-2">
      <input type="checkbox" name="allowOverpayment" className="mt-0.5 size-4 rounded border-slate-300" />
      <span>
        Allow overpayment
        <span className="block text-xs text-slate-500">Only tick this if you are knowingly paying more than the remaining contract balance.</span>
      </span>
    </label>
  );
}


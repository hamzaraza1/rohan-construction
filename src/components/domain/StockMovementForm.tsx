"use client";
import { useState } from "react";
import type { ActionResult } from "@/lib/mutation";
import { ActionForm } from "@/components/ui/ActionForm";
import { FormField } from "@/components/ui/FormField";
import { Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function StockMovementForm({
  action,
  materials,
  today,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  materials: { id: string; name: string; unit: string; onHand: string }[];
  today: string;
}) {
  const [type, setType] = useState("ISSUE");
  return (
    <ActionForm action={action} resetOnSuccess className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-6 lg:items-start">
      <FormField label="Entry" name="type" htmlFor="mv-type">
        <Select id="mv-type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="ISSUE">Issued / used</option>
          <option value="WASTAGE">Wastage / damage</option>
          <option value="ADJUSTMENT">Stock-count correction</option>
        </Select>
      </FormField>
      <FormField label="Material" name="materialId" htmlFor="mv-material" className="lg:col-span-2">
        <Select id="mv-material" name="materialId" required defaultValue="">
          <option value="">Select…</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>{m.name} — {m.onHand} {m.unit} in stock</option>
          ))}
        </Select>
      </FormField>
      {type === "ADJUSTMENT" ? (
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Direction" name="direction" htmlFor="mv-dir">
            <Select id="mv-dir" name="direction" defaultValue="OUT">
              <option value="OUT">− Missing</option>
              <option value="IN">+ Found</option>
            </Select>
          </FormField>
          <FormField label="Qty" name="quantity" htmlFor="mv-qty">
            <Input id="mv-qty" name="quantity" inputMode="decimal" required />
          </FormField>
        </div>
      ) : (
        <FormField label="Quantity" name="quantity" htmlFor="mv-qty">
          <Input id="mv-qty" name="quantity" inputMode="decimal" required />
        </FormField>
      )}
      <FormField label="Date" name="date" htmlFor="mv-date">
        <Input id="mv-date" name="date" type="date" defaultValue={today} max={today} required />
      </FormField>
      <FormField label={type === "ADJUSTMENT" ? "Reason (required)" : "Notes / where used"} name="notes" htmlFor="mv-notes">
        <Input id="mv-notes" name="notes" maxLength={500} required={type === "ADJUSTMENT"} />
      </FormField>
      <div className="lg:col-span-6"><SubmitButton>Save stock entry</SubmitButton></div>
    </ActionForm>
  );
}

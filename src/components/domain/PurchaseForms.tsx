"use client";
import Link from "next/link";
import { useState } from "react";
import type { ActionResult } from "@/lib/mutation";
import { ActionForm } from "@/components/ui/ActionForm";
import { FormField } from "@/components/ui/FormField";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ButtonLink } from "@/components/ui/Button";
import { LineItemsEditor, type LineValue, type MaterialOption } from "./LineItemsEditor";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
type SupplierOpt = { id: string; name: string };

function SupplierSelect({ suppliers, value, locked, newHref }: { suppliers: SupplierOpt[]; value: string; locked?: boolean; newHref?: string }) {
  if (locked) {
    return (
      <FormField label="Supplier" name="supplierId">
        <input type="hidden" name="supplierId" value={value} />
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{suppliers.find((s) => s.id === value)?.name}</div>
      </FormField>
    );
  }
  return (
    <FormField label="Supplier" name="supplierId" required>
      <div className="flex gap-2">
        <Select id="supplierId" name="supplierId" defaultValue={value} required className="flex-1">
          <option value="">Select a supplier…</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        {newHref && <Link href={newHref} className="shrink-0 self-center text-sm font-medium text-brand-700 hover:underline">+ New</Link>}
      </div>
    </FormField>
  );
}

export function PurchaseOrderForm({
  action, suppliers, materials, initial, cancelHref, submitLabel, newSupplierHref,
}: {
  action: Action;
  suppliers: SupplierOpt[];
  materials: MaterialOption[];
  initial: { supplierId: string; orderDate: string; expectedDate: string; notes: string; lines: Omit<LineValue, "key">[] };
  cancelHref: string;
  submitLabel: string;
  newSupplierHref?: string;
}) {
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <SupplierSelect suppliers={suppliers} value={initial.supplierId} newHref={newSupplierHref} />
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Order date" name="orderDate" required>
          <Input id="orderDate" name="orderDate" type="date" defaultValue={initial.orderDate} required />
        </FormField>
        <FormField label="Expected delivery" name="expectedDate">
          <Input id="expectedDate" name="expectedDate" type="date" defaultValue={initial.expectedDate} />
        </FormField>
      </div>
      <p className="text-sm text-slate-600 sm:col-span-2">
        A purchase order is a commitment only. It does not reduce cash or add stock. Stock and material cost are recorded when material is <strong>received</strong>; cash moves only when the supplier is <strong>paid</strong>.
      </p>
      <LineItemsEditor materials={materials} initial={initial.lines} />
      <FormField label="Notes" name="notes" className="sm:col-span-2">
        <Textarea id="notes" name="notes" defaultValue={initial.notes} rows={2} />
      </FormField>
      <div className="flex gap-2 sm:col-span-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        <ButtonLink href={cancelHref} variant="secondary">Cancel</ButtonLink>
      </div>
    </ActionForm>
  );
}

export function ReceiptForm({
  action, suppliers, materials, initial, fromOrder, cancelHref, maxDate, newSupplierHref,
}: {
  action: Action;
  suppliers: SupplierOpt[];
  materials: MaterialOption[];
  initial: { supplierId: string; purchaseOrderId: string; receiptDate: string; lines: Omit<LineValue, "key">[] };
  fromOrder?: { orderNumber: number };
  cancelHref: string;
  maxDate: string;
  newSupplierHref?: string;
}) {
  const [paidNow, setPaidNow] = useState(false);
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="purchaseOrderId" value={initial.purchaseOrderId} />
      <SupplierSelect suppliers={suppliers} value={initial.supplierId} locked={Boolean(fromOrder)} newHref={newSupplierHref} />
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Date received" name="receiptDate" required>
          <Input id="receiptDate" name="receiptDate" type="date" defaultValue={initial.receiptDate} max={maxDate} required />
        </FormField>
        <FormField label="Challan / bill no." name="challanNumber">
          <Input id="challanNumber" name="challanNumber" maxLength={60} />
        </FormField>
      </div>
      {fromOrder && (
        <p className="text-sm text-slate-600 sm:col-span-2">
          Receiving against <strong>PO-{fromOrder.orderNumber}</strong>. Enter the quantity actually delivered for each line; leave a line empty if nothing of it arrived.
        </p>
      )}
      <LineItemsEditor materials={materials} initial={initial.lines} allowAdd={!fromOrder} quantityLabel="Qty received" />
      {fromOrder && (
        <label className="flex items-start gap-2 text-sm text-slate-700 sm:col-span-2">
          <input type="checkbox" name="allowOverDelivery" className="mt-0.5 size-4 rounded border-slate-300" />
          <span>Allow more than ordered<span className="block text-xs text-slate-500">Tick only if the supplier really delivered more than the remaining order quantity.</span></span>
        </label>
      )}
      <FormField label="Notes" name="notes">
        <Textarea id="notes" name="notes" rows={2} />
      </FormField>
      <FormField label="Challan / bill attachment" name="attachment" hint="PDF, JPG, PNG or WEBP — up to 10 MB">
        <Input id="attachment" name="attachment" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm" />
      </FormField>
      <div className="rounded-lg border border-slate-200 p-4 sm:col-span-2">
        <label className="flex items-start gap-2 text-sm text-slate-800">
          <input type="checkbox" name="paidNow" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} className="mt-0.5 size-4 rounded border-slate-300" />
          <span>
            Paid in full on delivery (cash purchase)
            <span className="block text-xs text-slate-500">Also records a supplier payment for the full total, so nothing is left owing. Do not tick this if you will pay later or already paid an advance.</span>
          </span>
        </label>
        {paidNow && (
          <div className="mt-3 max-w-xs">
            <FormField label="Paid by" name="paidMethod">
              <Select id="paidMethod" name="paidMethod" defaultValue="CASH">
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </Select>
            </FormField>
          </div>
        )}
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <SubmitButton>Save receipt</SubmitButton>
        <ButtonLink href={cancelHref} variant="secondary">Cancel</ButtonLink>
      </div>
    </ActionForm>
  );
}

export function SupplierPaymentFields({
  defaultType,
  orders,
  defaultOrderId,
}: {
  defaultType: "ADVANCE" | "PAYMENT";
  orders: { id: string; orderNumber: number }[];
  defaultOrderId?: string;
}) {
  return (
    <>
      <FormField label="Payment type" name="type" required hint="Advance = paid before material arrives. Payment = against material already received.">
        <Select id="type" name="type" defaultValue={defaultType}>
          <option value="ADVANCE">Advance</option>
          <option value="PAYMENT">Payment against delivery</option>
        </Select>
      </FormField>
      <FormField label="Purchase order (optional)" name="purchaseOrderId">
        <Select id="purchaseOrderId" name="purchaseOrderId" defaultValue={defaultOrderId ?? ""}>
          <option value="">Not linked to an order</option>
          {orders.map((o) => <option key={o.id} value={o.id}>PO-{o.orderNumber}</option>)}
        </Select>
      </FormField>
    </>
  );
}

"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { checkAmount, checkDate, checkPhone, clean, parseAmount, required, today, useForm } from "@/lib/form";
import { supplierAccounts } from "@/lib/calculations";
import { formatMoney } from "@/lib/format";
import type { DeliveryLine, PaymentMethod, Supplier, SupplierPaymentType } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Button, IconButton } from "@/components/ui/Button";
import { Checkbox, FormField, Input, Segmented, Select } from "@/components/ui/Field";
import { FormModal, Grid, InfoBox, MethodField, ProjectSelect } from "./common";

export function SupplierForm({ onClose, supplier }: { onClose: () => void; supplier?: Supplier }) {
  const { data, add, update } = useStore();
  const toast = useToast();
  const [cats, setCats] = useState<string[]>(supplier?.materialCategoryIds ?? []);
  const f = useForm(
    { name: supplier?.name ?? "", contactPerson: supplier?.contactPerson ?? "", phone: supplier?.phone ?? "", address: supplier?.address ?? "", isActive: supplier?.isActive ?? true },
    (v) => clean({ name: required(v.name, "Supplier name"), phone: checkPhone(v.phone) }),
  );
  const submit = f.handleSubmit((v) => {
    const row = { name: v.name.trim(), contactPerson: v.contactPerson.trim() || undefined, phone: v.phone.trim(), address: v.address.trim() || undefined, materialCategoryIds: cats, isActive: v.isActive };
    if (supplier) {
      update("suppliers", supplier.id, row);
      toast("Supplier updated");
    } else {
      add("suppliers", row);
      toast(`Supplier “${row.name}” added`);
    }
    onClose();
  });
  return (
    <FormModal title={supplier ? "Edit supplier" : "Add supplier"} onClose={onClose} onSubmit={submit} submitLabel={supplier ? "Save changes" : "Add supplier"}>
      <FormField label="Supplier / shop name" htmlFor="name" required error={f.errors.name}>
        <Input {...f.bind("name")} placeholder="e.g. Al-Madina Cement Traders" />
      </FormField>
      <Grid>
        <FormField label="Contact person" htmlFor="contactPerson">
          <Input {...f.bind("contactPerson")} />
        </FormField>
        <FormField label="Phone" htmlFor="phone" required error={f.errors.phone}>
          <Input {...f.bind("phone")} inputMode="tel" placeholder="0300-1234567" />
        </FormField>
      </Grid>
      <FormField label="Address" htmlFor="address">
        <Input {...f.bind("address")} />
      </FormField>
      <FormField label="Supplies" hint="Material categories this supplier deals in">
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3">
          {data.materialCategories.filter((c) => c.isActive || cats.includes(c.id)).map((c) => (
            <Checkbox key={c.id} label={c.name} checked={cats.includes(c.id)} onChange={(e) => setCats((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)))} />
          ))}
        </div>
      </FormField>
      {supplier && <Checkbox label="Active" checked={f.values.isActive} onChange={(e) => f.set("isActive", e.target.checked)} />}
    </FormModal>
  );
}

type SPF = { projectId: string; supplierId: string; type: SupplierPaymentType; date: string; amount: string; method: PaymentMethod; reference: string; note: string };

export function SupplierPaymentForm({ onClose, supplierId, projectId }: { onClose: () => void; supplierId?: string; projectId?: string }) {
  const { data, add } = useStore();
  const toast = useToast();
  const f = useForm<SPF>(
    { projectId: projectId ?? "", supplierId: supplierId ?? "", type: "PAYMENT", date: today(), amount: "", method: "BANK_TRANSFER", reference: "", note: "" },
    (v) => clean({ projectId: required(v.projectId, "Project"), supplierId: required(v.supplierId, "Supplier"), date: checkDate(v.date), amount: checkAmount(v.amount) }),
  );
  const acc = f.values.projectId && f.values.supplierId ? supplierAccounts(data, f.values.projectId, f.values.supplierId)[0] : undefined;
  const submit = f.handleSubmit((v) => {
    const amount = parseAmount(v.amount);
    add("supplierPayments", { projectId: v.projectId, supplierId: v.supplierId, type: v.type, date: v.date, amount, method: v.method, reference: v.reference.trim() || undefined, note: v.note.trim() || undefined });
    toast(`${v.type === "ADVANCE" ? "Advance" : "Payment"} of ${formatMoney(amount)} recorded`);
    onClose();
  });
  return (
    <FormModal title="Pay supplier" description="Paying a supplier reduces cash. It does not add stock; only received material does." onClose={onClose} onSubmit={submit} submitLabel="Record payment">
      <Grid>
        <FormField label="Project" htmlFor="projectId" required error={f.errors.projectId}>
          <ProjectSelect {...f.bind("projectId")} disabled={Boolean(projectId)} />
        </FormField>
        <FormField label="Supplier" htmlFor="supplierId" required error={f.errors.supplierId}>
          <Select {...f.bind("supplierId")} disabled={Boolean(supplierId)}>
            <option value="">Select supplier…</option>
            {data.suppliers.filter((s) => s.isActive || s.id === f.values.supplierId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </FormField>
      </Grid>
      {f.values.projectId && f.values.supplierId && (
        <InfoBox tone={acc && acc.balance > 0 ? "amber" : "slate"}>
          {!acc ? "No deliveries or payments yet for this supplier on this project." : acc.balance > 0 ? <>Material received {formatMoney(acc.delivered)} · Paid {formatMoney(acc.paid)} · <b>Payable {formatMoney(acc.balance)}</b></> : acc.balance < 0 ? <>Advance already with supplier: <b>{formatMoney(-acc.balance)}</b> (not yet delivered)</> : "Account is fully settled."}
        </InfoBox>
      )}
      <FormField label="Payment type" required>
        <Segmented name="sptype" value={f.values.type} onChange={(t) => f.set("type", t)} options={[{ value: "PAYMENT", label: "Against deliveries" }, { value: "ADVANCE", label: "Advance (before delivery)" }]} />
      </FormField>
      <Grid>
        <FormField label="Amount (Rs.)" htmlFor="amount" required error={f.errors.amount}>
          <Input {...f.bind("amount")} inputMode="decimal" placeholder="0" />
        </FormField>
        <FormField label="Date paid" htmlFor="date" required error={f.errors.date}>
          <Input {...f.bind("date")} type="date" max={today()} />
        </FormField>
      </Grid>
      {acc && acc.balance > 0 && f.values.type === "PAYMENT" && !f.values.amount && (
        <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={() => f.set("amount", String(acc.balance))}>Pay full balance ({formatMoney(acc.balance)})</button>
      )}
      <FormField label="Payment method" required>
        <MethodField value={f.values.method} onChange={(m) => f.set("method", m)} />
      </FormField>
      <Grid>
        <FormField label="Reference" htmlFor="reference">
          <Input {...f.bind("reference")} placeholder="Cheque / transaction no." />
        </FormField>
        <FormField label="Note" htmlFor="note">
          <Input {...f.bind("note")} />
        </FormField>
      </Grid>
    </FormModal>
  );
}

type Line = { materialId: string; quantity: string; rate: string };

/** Material receiving: records what actually arrived at site. This adds stock and is the purchase cost. */
export function DeliveryForm({ onClose, projectId, supplierId }: { onClose: () => void; projectId?: string; supplierId?: string }) {
  const { data, add } = useStore();
  const toast = useToast();
  const [lines, setLines] = useState<Line[]>([{ materialId: "", quantity: "", rate: "" }]);
  const [lineErrors, setLineErrors] = useState<string[]>([]);
  const [paidNow, setPaidNow] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const f = useForm(
    { projectId: projectId ?? "", supplierId: supplierId ?? "", date: today(), challanNo: "", note: "" },
    (v) => clean({ projectId: required(v.projectId, "Project"), supplierId: required(v.supplierId, "Supplier"), date: checkDate(v.date) }),
  );
  const supplier = data.suppliers.find((s) => s.id === f.values.supplierId);
  const mats = supplier && supplier.materialCategoryIds.length ? [...data.materials].sort((a, b) => Number(!supplier.materialCategoryIds.includes(a.categoryId)) - Number(!supplier.materialCategoryIds.includes(b.categoryId))) : data.materials;
  const total = lines.reduce((t, l) => t + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0);

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const submit = f.handleSubmit((v) => {
    const errs: string[] = lines.map((l) => (!l.materialId ? "Select material" : checkAmount(l.quantity) ? "Enter quantity" : checkAmount(l.rate) ? "Enter rate" : ""));
    const dup = new Set<string>();
    lines.forEach((l, i) => {
      if (l.materialId && dup.has(l.materialId)) errs[i] = "Material listed twice";
      dup.add(l.materialId);
    });
    setLineErrors(errs);
    if (errs.some(Boolean)) return;
    const parsed: DeliveryLine[] = lines.map((l) => ({ materialId: l.materialId, quantity: parseAmount(l.quantity), rate: parseAmount(l.rate) }));
    add("deliveries", { projectId: v.projectId, supplierId: v.supplierId, date: v.date, challanNo: v.challanNo.trim() || undefined, note: v.note.trim() || undefined, lines: parsed });
    if (paidNow) add("supplierPayments", { projectId: v.projectId, supplierId: v.supplierId, type: "PAYMENT", date: v.date, amount: Math.round(total * 100) / 100, method, note: `Paid on delivery${v.challanNo ? ` (${v.challanNo.trim()})` : ""}` });
    toast(`Material received: ${formatMoney(total)}${paidNow ? " (paid on delivery)" : ""}`);
    onClose();
  });

  return (
    <FormModal title="Receive material" description="Record material that has actually arrived at site. This adds stock and creates the bill from the supplier." onClose={onClose} onSubmit={submit} size="lg" submitLabel="Save delivery">
      <Grid>
        <FormField label="Project / site" htmlFor="projectId" required error={f.errors.projectId}>
          <ProjectSelect {...f.bind("projectId")} disabled={Boolean(projectId)} />
        </FormField>
        <FormField label="Supplier" htmlFor="supplierId" required error={f.errors.supplierId}>
          <Select {...f.bind("supplierId")} disabled={Boolean(supplierId)}>
            <option value="">Select supplier…</option>
            {data.suppliers.filter((s) => s.isActive || s.id === f.values.supplierId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Date received" htmlFor="date" required error={f.errors.date}>
          <Input {...f.bind("date")} type="date" max={today()} />
        </FormField>
        <FormField label="Challan / bill no." htmlFor="challanNo">
          <Input {...f.bind("challanNo")} placeholder="e.g. CH-4512" />
        </FormField>
      </Grid>

      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700">Items received <span className="text-red-600">*</span></p>
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_7rem_7rem_8rem_2rem] gap-2 px-1 text-xs font-medium text-slate-500 sm:grid">
            <span>Material</span><span>Quantity</span><span>Rate (Rs.)</span><span className="text-right">Amount</span><span />
          </div>
          {lines.map((l, i) => {
            const m = data.materials.find((x) => x.id === l.materialId);
            return (
              <div key={i} className="rounded-lg border border-slate-200 p-2 sm:border-0 sm:p-0">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_7rem_7rem_8rem_2rem] sm:items-center">
                  <Select aria-label="Material" value={l.materialId} onChange={(e) => setLine(i, { materialId: e.target.value })} invalid={lineErrors[i] === "Select material" || lineErrors[i] === "Material listed twice"} className="col-span-2 sm:col-span-1">
                    <option value="">Select material…</option>
                    {mats.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.unit})</option>)}
                  </Select>
                  <Input aria-label="Quantity" inputMode="decimal" placeholder={m ? m.unit : "Qty"} value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} invalid={lineErrors[i] === "Enter quantity"} />
                  <Input aria-label="Rate" inputMode="decimal" placeholder="Rate" value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} invalid={lineErrors[i] === "Enter rate"} />
                  <span className="tabular text-sm font-medium text-slate-900 sm:text-right">{formatMoney((Number(l.quantity) || 0) * (Number(l.rate) || 0))}</span>
                  <IconButton label="Remove line" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} disabled={lines.length === 1} className="justify-self-end disabled:opacity-30">
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
                {lineErrors[i] && <p className="mt-1 text-xs text-red-600">{lineErrors[i]}</p>}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setLines((ls) => [...ls, { materialId: "", quantity: "", rate: "" }])}><Plus className="size-4" /> Add item</Button>
          <p className="text-sm">Total: <span className="tabular font-semibold text-slate-900">{formatMoney(total)}</span></p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <Checkbox label="Paid in full on delivery (cash purchase)" description="Also records a supplier payment for the total, so nothing stays payable" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} />
        {paidNow && <div className="mt-3"><MethodField value={method} onChange={setMethod} allowCheque={false} /></div>}
      </div>
      <FormField label="Note" htmlFor="note">
        <Input {...f.bind("note")} placeholder="e.g. 20 bags short — will come tomorrow" />
      </FormField>
    </FormModal>
  );
}

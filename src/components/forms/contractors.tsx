"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { checkAmount, checkCnic, checkDate, checkPhone, clean, parseAmount, required, today, useForm } from "@/lib/form";
import { contractBalance } from "@/lib/calculations";
import { CONTRACTOR_PAYMENT_TYPE_LABELS, formatMoney } from "@/lib/format";
import type { Contract, ContractStatus, Contractor, ContractorPaymentType, PaymentMethod } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Checkbox, FormField, Input, Segmented, Select, Textarea } from "@/components/ui/Field";
import { FormModal, Grid, InfoBox, ListEditor, MethodField, ProjectSelect } from "./common";

export function ContractorForm({ onClose, contractor }: { onClose: () => void; contractor?: Contractor }) {
  const { data, add, update } = useStore();
  const toast = useToast();
  const [specs, setSpecs] = useState<string[]>(contractor?.specializationIds ?? []);
  const [specError, setSpecError] = useState<string>();
  const f = useForm(
    { name: contractor?.name ?? "", phone: contractor?.phone ?? "", cnic: contractor?.cnic ?? "", address: contractor?.address ?? "", notes: contractor?.notes ?? "", isActive: contractor?.isActive ?? true },
    (v) => clean({ name: required(v.name, "Name"), phone: checkPhone(v.phone), cnic: checkCnic(v.cnic) }),
  );
  const submit = f.handleSubmit((v) => {
    if (specs.length === 0) return setSpecError("Select at least one type of work");
    const row = { name: v.name.trim(), phone: v.phone.trim(), cnic: v.cnic.trim() || undefined, address: v.address.trim() || undefined, notes: v.notes.trim() || undefined, specializationIds: specs, isActive: v.isActive };
    if (contractor) {
      update("contractors", contractor.id, row);
      toast("Contractor updated");
    } else {
      add("contractors", row);
      toast(`Contractor “${row.name}” added`);
    }
    onClose();
  });
  return (
    <FormModal title={contractor ? "Edit contractor" : "Add contractor"} onClose={onClose} onSubmit={submit} submitLabel={contractor ? "Save changes" : "Add contractor"}>
      <FormField label="Contractor / firm name" htmlFor="name" required error={f.errors.name}>
        <Input {...f.bind("name")} placeholder="e.g. Ustad Rafiq Ahmed" />
      </FormField>
      <Grid>
        <FormField label="Phone" htmlFor="phone" required error={f.errors.phone}>
          <Input {...f.bind("phone")} inputMode="tel" placeholder="0300-1234567" />
        </FormField>
        <FormField label="CNIC" htmlFor="cnic" error={f.errors.cnic}>
          <Input {...f.bind("cnic")} placeholder="35202-1234567-1" />
        </FormField>
      </Grid>
      <FormField label="Work specialization" required error={specError} hint="Categories are managed in Settings">
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3">
          {data.workCategories.filter((w) => w.isActive || specs.includes(w.id)).map((w) => (
            <Checkbox
              key={w.id}
              label={w.name}
              checked={specs.includes(w.id)}
              onChange={(e) => {
                setSpecError(undefined);
                setSpecs((s) => (e.target.checked ? [...s, w.id] : s.filter((x) => x !== w.id)));
              }}
            />
          ))}
        </div>
      </FormField>
      <FormField label="Address" htmlFor="address">
        <Input {...f.bind("address")} />
      </FormField>
      <FormField label="Notes" htmlFor="notes">
        <Textarea {...f.bind("notes")} rows={2} />
      </FormField>
      {contractor && <Checkbox label="Active" description="Inactive contractors are hidden when creating new contracts" checked={f.values.isActive} onChange={(e) => f.set("isActive", e.target.checked)} />}
    </FormModal>
  );
}

type CF = { projectId: string; contractorId: string; workCategoryId: string; title: string; amount: string; startDate: string; endDate: string; status: ContractStatus; progress: string; terms: string };

export function ContractForm({ onClose, contract, projectId, contractorId, onSaved }: { onClose: () => void; contract?: Contract; projectId?: string; contractorId?: string; onSaved?: (id: string) => void }) {
  const { data, add, update } = useStore();
  const toast = useToast();
  const [inc, setInc] = useState<string[]>(contract?.includedScope ?? []);
  const [exc, setExc] = useState<string[]>(contract?.excludedScope ?? []);
  const f = useForm<CF>(
    {
      projectId: contract?.projectId ?? projectId ?? "", contractorId: contract?.contractorId ?? contractorId ?? "", workCategoryId: contract?.workCategoryId ?? "",
      title: contract?.title ?? "", amount: contract ? String(contract.amount) : "", startDate: contract?.startDate ?? today(), endDate: contract?.endDate ?? "",
      status: contract?.status ?? "ACTIVE", progress: String(contract?.progress ?? 0), terms: contract?.terms ?? "",
    },
    (v) =>
      clean({
        projectId: required(v.projectId, "Project"), contractorId: required(v.contractorId, "Contractor"), workCategoryId: required(v.workCategoryId, "Type of work"),
        title: required(v.title, "Title"), amount: checkAmount(v.amount), startDate: checkDate(v.startDate, { notFuture: false }),
        endDate: v.endDate && v.endDate < v.startDate ? "End date must be after the start date" : undefined,
        progress: /^\d+$/.test(v.progress) && Number(v.progress) <= 100 ? undefined : "Enter 0 to 100",
      }),
  );
  const contractor = data.contractors.find((c) => c.id === f.values.contractorId);
  const project = data.projects.find((p) => p.id === f.values.projectId);

  const autoTitle = (wc: string, pid = f.values.projectId) => {
    const w = data.workCategories.find((x) => x.id === wc);
    const p = data.projects.find((x) => x.id === pid);
    return w ? `${w.name}${p ? ` — ${p.name}` : ""}` : "";
  };

  const submit = f.handleSubmit((v) => {
    const row = {
      projectId: v.projectId, contractorId: v.contractorId, workCategoryId: v.workCategoryId, title: v.title.trim(), amount: parseAmount(v.amount),
      startDate: v.startDate, endDate: v.endDate || undefined, status: v.status, progress: Number(v.progress), includedScope: inc, excludedScope: exc, terms: v.terms.trim() || undefined,
    };
    if (contract) {
      update("contracts", contract.id, row);
      toast("Contract updated");
      onSaved?.(contract.id);
    } else {
      const id = add("contracts", row);
      toast("Contract created");
      onSaved?.(id);
    }
    onClose();
  });

  return (
    <FormModal title={contract ? "Edit contract" : "New contract"} description="The contract amount is a commitment. Cash only moves when you record a payment." onClose={onClose} onSubmit={submit} size="lg" submitLabel={contract ? "Save changes" : "Create contract"}>
      <Grid>
        <FormField label="Project" htmlFor="projectId" required error={f.errors.projectId}>
          <ProjectSelect {...f.bind("projectId")} disabled={Boolean(contract)} />
        </FormField>
        <FormField label="Contractor" htmlFor="contractorId" required error={f.errors.contractorId}>
          <Select {...f.bind("contractorId")} disabled={Boolean(contract)}>
            <option value="">Select contractor…</option>
            {data.contractors.filter((c) => c.isActive || c.id === f.values.contractorId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Type of work" htmlFor="workCategoryId" required error={f.errors.workCategoryId} hint={contractor ? `Specializes in: ${contractor.specializationIds.map((id) => data.workCategories.find((w) => w.id === id)?.name).join(", ")}` : undefined}>
          <Select
            {...f.bind("workCategoryId")}
            onChange={(e) => {
              f.set("workCategoryId", e.target.value);
              if (!f.values.title || f.values.title === autoTitle(f.values.workCategoryId)) f.set("title", autoTitle(e.target.value));
            }}
          >
            <option value="">Select…</option>
            {data.workCategories.filter((w) => w.isActive).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Contract title" htmlFor="title" required error={f.errors.title}>
          <Input {...f.bind("title")} placeholder={project ? `e.g. Electrical — ${project.name}` : "e.g. Electrical work"} />
        </FormField>
      </Grid>
      <Grid cols={3}>
        <FormField label="Agreed amount (Rs.)" htmlFor="amount" required error={f.errors.amount}>
          <Input {...f.bind("amount")} inputMode="decimal" placeholder="0" />
        </FormField>
        <FormField label="Start date" htmlFor="startDate" required error={f.errors.startDate}>
          <Input {...f.bind("startDate")} type="date" />
        </FormField>
        <FormField label="Expected end" htmlFor="endDate" error={f.errors.endDate}>
          <Input {...f.bind("endDate")} type="date" min={f.values.startDate} />
        </FormField>
      </Grid>
      {contract && (
        <Grid>
          <FormField label="Status" htmlFor="status">
            <Select {...f.bind("status")}>
              <option value="ACTIVE">In progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="TERMINATED">Terminated</option>
            </Select>
          </FormField>
          <FormField label="Work progress (%)" htmlFor="progress" error={f.errors.progress}>
            <Input {...f.bind("progress")} type="number" min={0} max={100} />
          </FormField>
        </Grid>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Included in this contract">
          <ListEditor value={inc} onChange={setInc} placeholder="e.g. Brick work of all walls" tone="green" />
        </FormField>
        <FormField label="Excluded (not in this contract)">
          <ListEditor value={exc} onChange={setExc} placeholder="e.g. Waterproofing" tone="red" />
        </FormField>
      </div>
      <FormField label="Terms" htmlFor="terms">
        <Textarea {...f.bind("terms")} rows={2} placeholder="e.g. Payment against measured work; 10% retention released on completion" />
      </FormField>
    </FormModal>
  );
}

type PF = { contractId: string; type: ContractorPaymentType; date: string; amount: string; method: PaymentMethod; reference: string; note: string };

export function ContractorPaymentForm({ onClose, contractId, contractorId, projectId }: { onClose: () => void; contractId?: string; contractorId?: string; projectId?: string }) {
  const { data, add } = useStore();
  const toast = useToast();
  const [allowOver, setAllowOver] = useState(false);
  const contracts = data.contracts.filter((c) => (!contractorId || c.contractorId === contractorId) && (!projectId || c.projectId === projectId) && (c.status !== "TERMINATED" || c.id === contractId));
  const f = useForm<PF>(
    { contractId: contractId ?? "", type: "INSTALLMENT", date: today(), amount: "", method: "CASH", reference: "", note: "" },
    (v) => {
      const c = data.contracts.find((x) => x.id === v.contractId);
      const b = c && contractBalance(data, c);
      const amt = checkAmount(v.amount);
      return clean({
        contractId: required(v.contractId, "Contract"),
        date: checkDate(v.date),
        amount: amt ?? (b && !allowOver && parseAmount(v.amount) > b.outstanding ? `More than the remaining ${formatMoney(b.outstanding)}. Tick “allow overpayment” if intended.` : undefined),
      });
    },
  );
  const c = data.contracts.find((x) => x.id === f.values.contractId);
  const b = c && contractBalance(data, c);

  const submit = f.handleSubmit((v) => {
    const amount = parseAmount(v.amount);
    add("contractorPayments", { contractId: v.contractId, type: v.type, date: v.date, amount, method: v.method, reference: v.reference.trim() || undefined, note: v.note.trim() || undefined });
    toast(`${CONTRACTOR_PAYMENT_TYPE_LABELS[v.type]} of ${formatMoney(amount)} recorded`);
    onClose();
  });

  return (
    <FormModal title="Pay contractor" description="Records cash paid to the contractor. It reduces the project's cash." onClose={onClose} onSubmit={submit} submitLabel="Record payment">
      <FormField label="Contract" htmlFor="contractId" required error={f.errors.contractId}>
        <Select {...f.bind("contractId")} disabled={Boolean(contractId)}>
          <option value="">Select contract…</option>
          {contracts.map((k) => {
            const p = data.projects.find((x) => x.id === k.projectId);
            const who = data.contractors.find((x) => x.id === k.contractorId);
            return <option key={k.id} value={k.id}>{contractorId ? "" : `${who?.name} · `}{data.workCategories.find((w) => w.id === k.workCategoryId)?.name} · {p?.code}</option>;
          })}
        </Select>
      </FormField>
      {b && (
        <InfoBox tone="blue">
          Net payable {formatMoney(b.netPayable)} · Paid {formatMoney(b.paid)} · <span className="font-semibold">Remaining {formatMoney(b.outstanding)}</span>
        </InfoBox>
      )}
      <FormField label="Payment type" required>
        <Segmented name="type" value={f.values.type} onChange={(t) => f.set("type", t)} options={[{ value: "ADVANCE", label: "Advance" }, { value: "INSTALLMENT", label: "Installment" }, { value: "FINAL", label: "Final" }]} />
      </FormField>
      <Grid>
        <FormField label="Amount (Rs.)" htmlFor="amount" required error={f.errors.amount}>
          <Input {...f.bind("amount")} inputMode="decimal" placeholder="0" />
        </FormField>
        <FormField label="Date paid" htmlFor="date" required error={f.errors.date}>
          <Input {...f.bind("date")} type="date" max={today()} />
        </FormField>
      </Grid>
      {b && f.values.type === "FINAL" && b.outstanding > 0 && !f.values.amount && (
        <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={() => f.set("amount", String(b.outstanding))}>
          Fill remaining amount ({formatMoney(b.outstanding)})
        </button>
      )}
      <FormField label="Payment method" required>
        <MethodField value={f.values.method} onChange={(m) => f.set("method", m)} />
      </FormField>
      <Grid>
        <FormField label="Reference" htmlFor="reference">
          <Input {...f.bind("reference")} placeholder="Cheque / transaction no." />
        </FormField>
        <FormField label="Note" htmlFor="note">
          <Input {...f.bind("note")} placeholder="e.g. Running bill #3" />
        </FormField>
      </Grid>
      <Checkbox label="Allow overpayment" description="Only if you are intentionally paying more than the remaining balance" checked={allowOver} onChange={(e) => setAllowOver(e.target.checked)} />
    </FormModal>
  );
}

export function AdjustmentForm({ onClose, contractId }: { onClose: () => void; contractId: string }) {
  const { data, add } = useStore();
  const toast = useToast();
  const c = data.contracts.find((x) => x.id === contractId)!;
  const b = contractBalance(data, c);
  const f = useForm(
    { type: "EXTRA" as "EXTRA" | "DEDUCTION", amount: "", date: today(), reason: "" },
    (v) => clean({ amount: checkAmount(v.amount, v.type === "DEDUCTION" ? { max: b.netPayable } : {}), date: checkDate(v.date), reason: required(v.reason, "Reason") }),
  );
  const submit = f.handleSubmit((v) => {
    add("contractAdjustments", { contractId, type: v.type, amount: parseAmount(v.amount), date: v.date, reason: v.reason.trim() });
    toast(v.type === "EXTRA" ? "Extra work added" : "Deduction added");
    onClose();
  });
  return (
    <FormModal title="Extra work or deduction" description="Changes how much is owed to the contractor. It does not move cash." onClose={onClose} onSubmit={submit} size="sm" submitLabel="Add">
      <Segmented name="adjType" value={f.values.type} onChange={(t) => f.set("type", t)} options={[{ value: "EXTRA", label: "Extra work (+)" }, { value: "DEDUCTION", label: "Deduction (−)" }]} />
      <Grid>
        <FormField label="Amount (Rs.)" htmlFor="amount" required error={f.errors.amount}>
          <Input {...f.bind("amount")} inputMode="decimal" />
        </FormField>
        <FormField label="Date" htmlFor="date" required error={f.errors.date}>
          <Input {...f.bind("date")} type="date" max={today()} />
        </FormField>
      </Grid>
      <FormField label="Reason" htmlFor="reason" required error={f.errors.reason}>
        <Input {...f.bind("reason")} placeholder={f.values.type === "EXTRA" ? "e.g. Boundary wall added" : "e.g. Rework at contractor's cost"} />
      </FormField>
    </FormModal>
  );
}

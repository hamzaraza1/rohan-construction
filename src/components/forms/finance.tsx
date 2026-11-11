"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { checkAmount, checkDate, clean, parseAmount, required, today, useForm } from "@/lib/form";
import { projectFinancials } from "@/lib/calculations";
import { formatMoney } from "@/lib/format";
import type { AttachmentInfo, Expense, PaymentMethod, Withdrawal } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { FileDrop } from "@/components/ui/FileDrop";
import { FormField, Input, Select, Textarea } from "@/components/ui/Field";
import { FormModal, Grid, InfoBox, MethodField, ProjectSelect } from "./common";

type EF = { projectId: string; categoryId: string; date: string; amount: string; paidTo: string; method: PaymentMethod; description: string };

export function ExpenseForm({ onClose, expense, projectId, miscOnly }: { onClose: () => void; expense?: Expense; projectId?: string; miscOnly?: boolean }) {
  const { data, add, update } = useStore();
  const toast = useToast();
  const [attachment, setAttachment] = useState<AttachmentInfo | undefined>(expense?.attachment);
  const f = useForm<EF>(
    {
      projectId: expense?.projectId ?? projectId ?? "", categoryId: expense?.categoryId ?? (miscOnly ? data.expenseCategories.find((c) => c.isMiscellaneous)?.id ?? "" : ""),
      date: expense?.date ?? today(), amount: expense ? String(expense.amount) : "", paidTo: expense?.paidTo ?? "", method: expense?.method ?? "CASH", description: expense?.description ?? "",
    },
    (v) => clean({ projectId: required(v.projectId, "Project"), categoryId: required(v.categoryId, "Category"), date: checkDate(v.date), amount: checkAmount(v.amount), paidTo: required(v.paidTo, "Paid to"), description: required(v.description, "Description") }),
  );
  const regular = data.expenseCategories.filter((c) => !c.isMiscellaneous && (c.isActive || c.id === f.values.categoryId));
  const misc = data.expenseCategories.filter((c) => c.isMiscellaneous && (c.isActive || c.id === f.values.categoryId));

  const submit = f.handleSubmit((v) => {
    const row = { projectId: v.projectId, categoryId: v.categoryId, date: v.date, amount: parseAmount(v.amount), paidTo: v.paidTo.trim(), method: v.method, description: v.description.trim(), attachment };
    if (expense) {
      update("expenses", expense.id, row);
      toast("Expense updated");
    } else {
      add("expenses", row);
      toast(`Expense of ${formatMoney(row.amount)} added`);
    }
    onClose();
  });

  return (
    <FormModal
      title={expense ? "Edit expense" : miscOnly ? "Add miscellaneous expense" : "Add expense"}
      description="Site running costs. Supplier and contractor payments are recorded in their own modules, not here."
      onClose={onClose}
      onSubmit={submit}
      submitLabel={expense ? "Save changes" : "Add expense"}
    >
      <Grid>
        <FormField label="Project" htmlFor="projectId" required error={f.errors.projectId}>
          <ProjectSelect {...f.bind("projectId")} />
        </FormField>
        <FormField label="Category" htmlFor="categoryId" required error={f.errors.categoryId}>
          <Select {...f.bind("categoryId")}>
            <option value="">Select category…</option>
            {!miscOnly && <optgroup label="Regular expenses">{regular.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
            <optgroup label="Miscellaneous / irregular">{misc.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
          </Select>
        </FormField>
        <FormField label="Amount (Rs.)" htmlFor="amount" required error={f.errors.amount}>
          <Input {...f.bind("amount")} inputMode="decimal" placeholder="0" />
        </FormField>
        <FormField label="Date" htmlFor="date" required error={f.errors.date}>
          <Input {...f.bind("date")} type="date" max={today()} />
        </FormField>
      </Grid>
      <FormField label="Paid to" htmlFor="paidTo" required error={f.errors.paidTo}>
        <Input {...f.bind("paidTo")} placeholder="e.g. Mazda loader driver, LESCO" />
      </FormField>
      <FormField label="Payment method" required>
        <MethodField value={f.values.method} onChange={(m) => f.set("method", m)} />
      </FormField>
      <FormField label="Description" htmlFor="description" required error={f.errors.description}>
        <Textarea {...f.bind("description")} rows={2} placeholder="What was this for?" />
      </FormField>
      <FormField label="Receipt">
        <FileDrop value={attachment} onChange={setAttachment} />
      </FormField>
    </FormModal>
  );
}

type WF = { partnerId: string; projectId: string; date: string; amount: string; method: PaymentMethod; note: string };

export function WithdrawalForm({ onClose, withdrawal, partnerId, projectId }: { onClose: () => void; withdrawal?: Withdrawal; partnerId?: string; projectId?: string }) {
  const { data, add, update } = useStore();
  const toast = useToast();
  const f = useForm<WF>(
    { partnerId: withdrawal?.partnerId ?? partnerId ?? "", projectId: withdrawal?.projectId ?? projectId ?? "", date: withdrawal?.date ?? today(), amount: withdrawal ? String(withdrawal.amount) : "", method: withdrawal?.method ?? "BANK_TRANSFER", note: withdrawal?.note ?? "" },
    (v) => clean({ partnerId: required(v.partnerId, "Partner"), projectId: required(v.projectId, "Project"), date: checkDate(v.date), amount: checkAmount(v.amount) }),
  );
  const fin = f.values.projectId ? projectFinancials(data, f.values.projectId) : undefined;
  const cashAfter = fin ? fin.cash + (withdrawal?.projectId === f.values.projectId ? withdrawal.amount : 0) - (parseAmount(f.values.amount) || 0) : undefined;

  const submit = f.handleSubmit((v) => {
    const row = { partnerId: v.partnerId, projectId: v.projectId, date: v.date, amount: parseAmount(v.amount), method: v.method, note: v.note.trim() || undefined };
    if (withdrawal) {
      update("withdrawals", withdrawal.id, row);
      toast("Withdrawal updated");
    } else {
      add("withdrawals", row);
      toast(`Withdrawal of ${formatMoney(row.amount)} recorded`);
    }
    onClose();
  });

  return (
    <FormModal title={withdrawal ? "Edit withdrawal" : "Record partner withdrawal"} description="Money taken out by a partner. It reduces the project's cash but is not a project expense." onClose={onClose} onSubmit={submit} submitLabel={withdrawal ? "Save changes" : "Record withdrawal"}>
      <Grid>
        <FormField label="Partner" htmlFor="partnerId" required error={f.errors.partnerId}>
          <Select {...f.bind("partnerId")}>
            <option value="">Select partner…</option>
            {data.partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </FormField>
        <FormField label="From project" htmlFor="projectId" required error={f.errors.projectId}>
          <ProjectSelect {...f.bind("projectId")} />
        </FormField>
        <FormField label="Amount (Rs.)" htmlFor="amount" required error={f.errors.amount}>
          <Input {...f.bind("amount")} inputMode="decimal" placeholder="0" />
        </FormField>
        <FormField label="Date" htmlFor="date" required error={f.errors.date}>
          <Input {...f.bind("date")} type="date" max={today()} />
        </FormField>
      </Grid>
      {fin && cashAfter !== undefined && (
        <InfoBox tone={cashAfter < 0 ? "red" : "slate"}>
          Project cash available: <b>{formatMoney(fin.cash + (withdrawal?.projectId === f.values.projectId ? withdrawal.amount : 0))}</b>
          {f.values.amount && <> · After this withdrawal: <b>{formatMoney(cashAfter)}</b></>}
          {cashAfter < 0 && <span className="mt-1 block text-xs">Warning: this takes the project&apos;s cash below zero.</span>}
        </InfoBox>
      )}
      <FormField label="Payment method" required>
        <MethodField value={f.values.method} onChange={(m) => f.set("method", m)} />
      </FormField>
      <FormField label="Note" htmlFor="note">
        <Input {...f.bind("note")} placeholder="e.g. Profit share" />
      </FormField>
    </FormModal>
  );
}

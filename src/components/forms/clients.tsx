"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { checkAmount, checkCnic, checkDate, checkEmail, checkPhone, clean, parseAmount, required, today, useForm } from "@/lib/form";
import { formatMoney } from "@/lib/format";
import { projectFinancials } from "@/lib/calculations";
import type { AttachmentInfo, Client, ClientPayment, PaymentMethod } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { FileDrop } from "@/components/ui/FileDrop";
import { FormField, Input, Textarea } from "@/components/ui/Field";
import { FormModal, Grid, InfoBox, MethodField, ProjectSelect } from "./common";

export function ClientForm({ onClose, client, onSaved }: { onClose: () => void; client?: Client; onSaved?: (id: string) => void }) {
  const { add, update } = useStore();
  const toast = useToast();
  const f = useForm(
    { name: client?.name ?? "", phone: client?.phone ?? "", email: client?.email ?? "", cnic: client?.cnic ?? "", address: client?.address ?? "", notes: client?.notes ?? "" },
    (v) => clean({ name: required(v.name, "Client name"), phone: checkPhone(v.phone), email: checkEmail(v.email), cnic: checkCnic(v.cnic) }),
  );
  const submit = f.handleSubmit((v) => {
    const row = { name: v.name.trim(), phone: v.phone.trim(), email: v.email.trim() || undefined, cnic: v.cnic.trim() || undefined, address: v.address.trim() || undefined, notes: v.notes.trim() || undefined };
    if (client) {
      update("clients", client.id, row);
      toast("Client updated");
      onSaved?.(client.id);
    } else {
      const id = add("clients", { ...row, createdAt: today() });
      toast(`Client “${row.name}” added`);
      onSaved?.(id);
    }
    onClose();
  });
  return (
    <FormModal title={client ? "Edit client" : "Add client"} onClose={onClose} onSubmit={submit} submitLabel={client ? "Save changes" : "Add client"}>
      <FormField label="Client / company name" htmlFor="name" required error={f.errors.name}>
        <Input {...f.bind("name")} placeholder="e.g. Imran Qureshi" />
      </FormField>
      <Grid>
        <FormField label="Phone" htmlFor="phone" required error={f.errors.phone}>
          <Input {...f.bind("phone")} inputMode="tel" placeholder="0300-1234567" />
        </FormField>
        <FormField label="Email" htmlFor="email" error={f.errors.email}>
          <Input {...f.bind("email")} type="email" placeholder="name@example.com" />
        </FormField>
      </Grid>
      <FormField label="CNIC" htmlFor="cnic" error={f.errors.cnic} hint="Optional">
        <Input {...f.bind("cnic")} placeholder="35202-1234567-1" />
      </FormField>
      <FormField label="Address" htmlFor="address">
        <Textarea {...f.bind("address")} rows={2} />
      </FormField>
      <FormField label="Notes" htmlFor="notes">
        <Textarea {...f.bind("notes")} rows={2} placeholder="e.g. Pays by cheque only" />
      </FormField>
    </FormModal>
  );
}

type PayF = { projectId: string; date: string; amount: string; method: PaymentMethod; bankName: string; reference: string; note: string };

export function ClientPaymentForm({ onClose, payment, projectId }: { onClose: () => void; payment?: ClientPayment; projectId?: string }) {
  const { data, add, update } = useStore();
  const toast = useToast();
  const f = useForm<PayF>(
    {
      projectId: payment?.projectId ?? projectId ?? "",
      date: payment?.date ?? today(),
      amount: payment ? String(payment.amount) : "",
      method: payment?.method ?? "BANK_TRANSFER",
      bankName: payment?.bankName ?? "",
      reference: payment?.reference ?? "",
      note: payment?.note ?? "",
    },
    (v) => clean({ projectId: required(v.projectId, "Project"), date: checkDate(v.date), amount: checkAmount(v.amount), bankName: v.method !== "CASH" ? required(v.bankName, "Bank name") : undefined }),
  );
  const [attachment, setAttachment] = useState<AttachmentInfo | undefined>(payment?.attachment);
  const project = data.projects.find((p) => p.id === f.values.projectId);
  const fin = project ? projectFinancials(data, project.id) : undefined;
  const client = project && data.clients.find((c) => c.id === project.clientId);

  const submit = f.handleSubmit((v) => {
    const row = {
      projectId: v.projectId, date: v.date, amount: parseAmount(v.amount), method: v.method,
      bankName: v.method === "CASH" ? undefined : v.bankName.trim(), reference: v.reference.trim() || undefined, note: v.note.trim() || undefined, attachment,
    };
    if (payment) {
      update("clientPayments", payment.id, row);
      toast("Payment updated");
    } else {
      add("clientPayments", row);
      toast(`Payment of ${formatMoney(row.amount)} recorded`);
    }
    onClose();
  });

  return (
    <FormModal title={payment ? "Edit client payment" : "Record client payment"} description="Money received from the client for a project." onClose={onClose} onSubmit={submit} submitLabel={payment ? "Save changes" : "Record payment"}>
      <FormField label="Project" htmlFor="projectId" required error={f.errors.projectId}>
        <ProjectSelect {...f.bind("projectId")} disabled={Boolean(payment)} />
      </FormField>
      {project && fin && (
        <InfoBox tone="blue">
          <span className="font-medium">{client?.name}</span> · Contract {formatMoney(project.contractValue)} · Received so far {formatMoney(fin.received)} ·{" "}
          <span className="font-medium">Balance {formatMoney(fin.clientBalance)}</span>
        </InfoBox>
      )}
      <Grid>
        <FormField label="Amount (Rs.)" htmlFor="amount" required error={f.errors.amount}>
          <Input {...f.bind("amount")} inputMode="decimal" placeholder="0" />
        </FormField>
        <FormField label="Date received" htmlFor="date" required error={f.errors.date}>
          <Input {...f.bind("date")} type="date" max={today()} />
        </FormField>
      </Grid>
      <FormField label="Payment method" required>
        <MethodField value={f.values.method} onChange={(m) => f.set("method", m)} />
      </FormField>
      {f.values.method !== "CASH" && (
        <Grid>
          <FormField label="Bank" htmlFor="bankName" required error={f.errors.bankName}>
            <Input {...f.bind("bankName")} placeholder="e.g. Meezan Bank" list="banks" />
            <datalist id="banks">{["Meezan Bank", "HBL", "UBL", "Bank Alfalah", "MCB Bank", "Allied Bank"].map((b) => <option key={b} value={b} />)}</datalist>
          </FormField>
          <FormField label={f.values.method === "CHEQUE" ? "Cheque number" : "Transaction reference"} htmlFor="reference">
            <Input {...f.bind("reference")} placeholder={f.values.method === "CHEQUE" ? "CHQ 12345678" : "IBFT-123456"} />
          </FormField>
        </Grid>
      )}
      <FormField label="Note" htmlFor="note">
        <Input {...f.bind("note")} placeholder="e.g. Running payment — November" />
      </FormField>
      <FormField label="Receipt / deposit slip">
        <FileDrop value={attachment} onChange={setAttachment} />
      </FormField>
    </FormModal>
  );
}

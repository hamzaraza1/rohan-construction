"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Banknote, Check, Pencil, Plus, Wallet, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { contractBalance } from "@/lib/calculations";
import { formatDate, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge, ContractStatusBadge, ProgressBar } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTable } from "@/components/ui/DataTable";
import { AdjustmentForm, ContractForm, ContractorPaymentForm } from "@/components/forms/contractors";
import { ContractorPaymentsTable } from "@/components/domain/Tables";
import { RowActions } from "@/components/domain/RowActions";

export default function ContractPage() {
  const { id } = useParams<{ id: string }>();
  const { data, canEdit, remove } = useStore();
  const [form, setForm] = useState<"edit" | "pay" | "adj">();
  const k = data.contracts.find((x) => x.id === id);
  if (!k) return <Card><EmptyState title="Contract not found" action={<ButtonLink href="/contractors" variant="secondary">Back to contractors</ButtonLink>} /></Card>;
  const b = contractBalance(data, k);
  const project = data.projects.find((p) => p.id === k.projectId);
  const contractor = data.contractors.find((c) => c.id === k.contractorId);
  const work = data.workCategories.find((w) => w.id === k.workCategoryId);
  const adjustments = data.contractAdjustments.filter((a) => a.contractId === k.id);
  const paidPct = b.netPayable ? Math.min(100, Math.round((b.paid / b.netPayable) * 100)) : 0;
  const close = () => setForm(undefined);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Contractors", href: "/contractors" }, { label: contractor?.name ?? "", href: `/contractors/${k.contractorId}` }, { label: work?.name ?? "Contract" }]}
        title={k.title}
        meta={
          <>
            <ContractStatusBadge status={k.status} />
            <span>Contractor: <Link href={`/contractors/${k.contractorId}`} className="font-medium text-brand-700 hover:underline">{contractor?.name}</Link></span>
            <span>Project: <Link href={`/projects/${k.projectId}?tab=contractors`} className="font-medium text-brand-700 hover:underline">{project?.name}</Link></span>
            <span>{formatDate(k.startDate)} → {formatDate(k.endDate)}</span>
          </>
        }
        actions={
          canEdit && (
            <>
              <Button variant="secondary" onClick={() => setForm("edit")}><Pencil className="size-4" /> Edit</Button>
              <Button variant="secondary" onClick={() => setForm("adj")}>Extra / deduction</Button>
              <Button onClick={() => setForm("pay")}><Banknote className="size-4" /> Pay contractor</Button>
            </>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Agreed amount" value={formatMoney(k.amount)} hint="Commitment, not cash" />
        <StatCard label="Net payable" value={formatMoney(b.netPayable)} hint={`+ ${formatMoney(b.extras)} extras − ${formatMoney(b.deductions)} deductions`} tone="brand" />
        <StatCard label="Paid" value={formatMoney(b.paid)} hint={`${paidPct}% of net payable`} icon={<Banknote className="size-5" />} />
        {b.overpaid > 0 ? (
          <StatCard label="Overpaid" value={formatMoney(b.overpaid)} tone="negative" hint="Paid more than the net payable" />
        ) : (
          <StatCard label="Outstanding balance" value={formatMoney(b.outstanding)} icon={<Wallet className="size-5" />} tone={b.outstanding > 0 ? "warning" : "positive"} />
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Work scope" description="What is and is not included in this contract" />
          <div className="grid gap-6 p-5 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-800"><span className="flex size-5 items-center justify-center rounded-full bg-emerald-100"><Check className="size-3.5" /></span>Included</h3>
              {k.includedScope.length ? <ul className="space-y-1.5">{k.includedScope.map((s) => <li key={s} className="flex gap-2 text-sm text-slate-700"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{s}</li>)}</ul> : <p className="text-sm text-slate-500">Nothing listed.</p>}
            </div>
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-800"><span className="flex size-5 items-center justify-center rounded-full bg-red-100"><X className="size-3.5" /></span>Excluded</h3>
              {k.excludedScope.length ? <ul className="space-y-1.5">{k.excludedScope.map((s) => <li key={s} className="flex gap-2 text-sm text-slate-700"><X className="mt-0.5 size-4 shrink-0 text-red-500" />{s}</li>)}</ul> : <p className="text-sm text-slate-500">Nothing listed.</p>}
            </div>
          </div>
          {k.terms && <div className="border-t border-slate-100 px-5 py-3 text-sm text-slate-600"><span className="font-medium text-slate-900">Terms: </span>{k.terms}</div>}
        </Card>
        <Card>
          <CardHeader title="Progress" />
          <div className="space-y-5 p-5">
            <div>
              <div className="mb-1.5 flex justify-between text-sm"><span className="text-slate-600">Work done</span></div>
              <ProgressBar value={k.progress} />
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-sm"><span className="text-slate-600">Paid vs net payable</span></div>
              <ProgressBar value={paidPct} />
            </div>
            {k.progress < paidPct && k.status === "ACTIVE" && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Payments ({paidPct}%) are ahead of work done ({k.progress}%).</p>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Extra work and deductions" description="These change what is owed to the contractor. They do not move cash." actions={canEdit && <Button size="sm" variant="secondary" onClick={() => setForm("adj")}><Plus className="size-4" /> Add</Button>} />
        <DataTable
          rows={adjustments}
          rowKey={(a) => a.id}
          initialSort={{ key: "date", dir: "desc" }}
          emptyTitle="No extras or deductions"
          columns={[
            { key: "date", header: "Date", sortValue: (a) => a.date, render: (a) => formatDate(a.date) },
            { key: "type", header: "Type", render: (a) => (a.type === "EXTRA" ? <Badge tone="blue">Extra work</Badge> : <Badge tone="amber">Deduction</Badge>) },
            { key: "reason", header: "Reason", render: (a) => a.reason },
            { key: "amount", header: "Amount", align: "right", sortValue: (a) => a.amount, render: (a) => <span className="font-medium">{a.type === "DEDUCTION" ? "− " : "+ "}{formatMoney(a.amount)}</span> },
            { key: "actions", header: <span className="sr-only">Actions</span>, render: (a) => <RowActions onDelete={() => remove("contractAdjustments", a.id)} deleteTitle="Delete this adjustment?" /> },
          ]}
        />
      </Card>

      <Card className="mt-6">
        <CardHeader title="Payments" description="Advance, installments and final payment for this contract" />
        <ContractorPaymentsTable contractId={k.id} />
      </Card>

      {form === "edit" && <ContractForm contract={k} onClose={close} />}
      {form === "pay" && <ContractorPaymentForm contractId={k.id} onClose={close} />}
      {form === "adj" && <AdjustmentForm contractId={k.id} onClose={close} />}
    </>
  );
}

"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Banknote, FileSignature, HardHat, Pencil, Phone, Plus, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import { contractorTotals } from "@/lib/calculations";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, DetailList, StatCard } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ContractForm, ContractorForm, ContractorPaymentForm } from "@/components/forms/contractors";
import { ContractorPaymentsTable, ContractsTable } from "@/components/domain/Tables";

export default function ContractorPage() {
  const { id } = useParams<{ id: string }>();
  const { data, canEdit } = useStore();
  const [form, setForm] = useState<"edit" | "contract" | "pay">();
  const c = data.contractors.find((x) => x.id === id);
  if (!c) return <Card><EmptyState title="Contractor not found" action={<ButtonLink href="/contractors" variant="secondary">Back to contractors</ButtonLink>} /></Card>;
  const t = contractorTotals(data, c.id);
  const close = () => setForm(undefined);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Contractors", href: "/contractors" }, { label: c.name }]}
        title={c.name}
        meta={
          <>
            <span className="flex items-center gap-1.5"><Phone className="size-4 text-slate-400" />{c.phone}</span>
            <span className="flex flex-wrap gap-1">{c.specializationIds.map((s) => <Badge key={s} tone="blue">{data.workCategories.find((w) => w.id === s)?.name}</Badge>)}</span>
            {!c.isActive && <Badge tone="red">Inactive</Badge>}
          </>
        }
        actions={
          canEdit && (
            <>
              <Button variant="secondary" onClick={() => setForm("edit")}><Pencil className="size-4" /> Edit</Button>
              {t.contracts > 0 && <Button variant="secondary" onClick={() => setForm("pay")}><Banknote className="size-4" /> Pay contractor</Button>}
              <Button onClick={() => setForm("contract")}><Plus className="size-4" /> New contract</Button>
            </>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Contracts" value={t.contracts} hint={`${t.active} running`} icon={<FileSignature className="size-5" />} tone="brand" />
        <StatCard label="Total contract value" value={formatMoney(t.committed)} hint="Incl. extras and deductions" icon={<HardHat className="size-5" />} />
        <StatCard label="Paid" value={formatMoney(t.paid)} hint="Advances + installments + final" icon={<Banknote className="size-5" />} />
        <StatCard label="Outstanding balance" value={formatMoney(t.outstanding)} icon={<Wallet className="size-5" />} tone={t.outstanding > 0 ? "warning" : "positive"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Contracts" description="Click a contract to see its work scope and payments" />
          <ContractsTable contractorId={c.id} />
        </Card>
        <Card>
          <CardHeader title="Contractor details" />
          <DetailList items={[["Phone", c.phone], ["CNIC", c.cnic], ["Address", c.address], ["Status", c.isActive ? "Active" : "Inactive"], ["Notes", c.notes]]} />
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Payment history" description="Advances, installments and final payments across all contracts" />
        <ContractorPaymentsTable contractorId={c.id} />
      </Card>

      {form === "edit" && <ContractorForm contractor={c} onClose={close} />}
      {form === "contract" && <ContractForm contractorId={c.id} onClose={close} />}
      {form === "pay" && <ContractorPaymentForm contractorId={c.id} onClose={close} />}
    </>
  );
}

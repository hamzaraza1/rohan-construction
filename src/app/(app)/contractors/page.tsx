"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Banknote, HardHat, Plus, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { contractorTotals, sum } from "@/lib/calculations";
import { formatMoney } from "@/lib/format";
import type { Contractor } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable, FilterSelect, type Column } from "@/components/ui/DataTable";
import { ContractorForm, ContractForm, ContractorPaymentForm } from "@/components/forms/contractors";
import { RowActions } from "@/components/domain/RowActions";
import { ContractsTable } from "@/components/domain/Tables";
import { Tabs } from "@/components/ui/Tabs";

export default function ContractorsPage() {
  const { data, canEdit, remove } = useStore();
  const router = useRouter();
  const [form, setForm] = useState<{ contractor?: Contractor } | null>(null);
  const [contractForm, setContractForm] = useState(false);
  const [payForm, setPayForm] = useState(false);
  const [spec, setSpec] = useState("");
  const [status, setStatus] = useState("active");
  const [view, setView] = useState<"contractors" | "contracts">("contractors");

  const rows = useMemo(
    () => data.contractors.map((c) => ({ ...c, t: contractorTotals(data, c.id) })).filter((c) => (!spec || c.specializationIds.includes(spec)) && (status === "all" || (status === "active") === c.isActive)),
    [data, spec, status],
  );
  const all = useMemo(() => data.contractors.map((c) => contractorTotals(data, c.id)), [data]);
  type R = (typeof rows)[number];

  const columns: Column<R>[] = [
    {
      key: "name",
      header: "Contractor",
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="min-w-44">
          <Link href={`/contractors/${r.id}`} className="font-medium text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>{r.name}</Link>
          <div className="text-xs text-slate-500">{r.phone}</div>
        </div>
      ),
    },
    {
      key: "spec",
      header: "Specialization",
      render: (r) => (
        <div className="flex max-w-xs flex-wrap gap-1">
          {r.specializationIds.map((id) => <Badge key={id}>{data.workCategories.find((w) => w.id === id)?.name}</Badge>)}
          {!r.isActive && <Badge tone="red">Inactive</Badge>}
        </div>
      ),
    },
    { key: "contracts", header: "Contracts", align: "center", sortValue: (r) => r.t.contracts, render: (r) => <span>{r.t.contracts}{r.t.active > 0 && <span className="ml-1 text-xs text-blue-700">({r.t.active} running)</span>}</span> },
    { key: "committed", header: "Contract value", align: "right", sortValue: (r) => r.t.committed, render: (r) => formatMoney(r.t.committed) },
    { key: "paid", header: "Paid", align: "right", sortValue: (r) => r.t.paid, render: (r) => formatMoney(r.t.paid) },
    { key: "outstanding", header: "Outstanding", align: "right", sortValue: (r) => r.t.outstanding, render: (r) => <span className={r.t.outstanding > 0 ? "font-semibold text-amber-700" : "text-slate-400"}>{formatMoney(r.t.outstanding)}</span> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      render: (r) => <RowActions onEdit={() => setForm({ contractor: r })} onDelete={() => remove("contractors", r.id)} disabledReason={r.t.contracts > 0 ? "This contractor has contracts. Mark them inactive instead of deleting." : undefined} deleteTitle={`Delete ${r.name}?`} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Contractors"
        description="Labour contractors, their contracts and what is still payable"
        actions={
          canEdit && (
            <>
              <Button variant="secondary" onClick={() => setPayForm(true)}><Banknote className="size-4" /> Pay contractor</Button>
              <Button variant="secondary" onClick={() => setContractForm(true)}>New contract</Button>
              <Button onClick={() => setForm({})}><Plus className="size-4" /> Add contractor</Button>
            </>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Contractors" value={data.contractors.filter((c) => c.isActive).length} hint={`${data.contracts.filter((c) => c.status === "ACTIVE").length} contracts running`} icon={<Users className="size-5" />} tone="brand" />
        <StatCard label="Paid to contractors" value={formatMoney(sum(all, (t) => t.paid))} hint={`of ${formatMoney(sum(all, (t) => t.committed))} contracted`} icon={<HardHat className="size-5" />} />
        <StatCard label="Outstanding balance" value={formatMoney(sum(all, (t) => t.outstanding))} hint="Contract value not yet paid" icon={<Banknote className="size-5" />} tone="warning" />
      </div>

      <Tabs className="mt-6 mb-4" value={view} onChange={setView} tabs={[{ value: "contractors", label: "Contractors", count: data.contractors.length }, { value: "contracts", label: "All contracts", count: data.contracts.length }]} />

      {view === "contractors" ? (
        <Card>
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/contractors/${r.id}`)}
            searchText={(r) => `${r.name} ${r.phone} ${r.cnic ?? ""}`}
            searchPlaceholder="Search name, phone, CNIC…"
            initialSort={{ key: "outstanding", dir: "desc" }}
            toolbar={
              <>
                <FilterSelect label="Specialization" value={spec} onChange={setSpec}>
                  <option value="">All work types</option>
                  {data.workCategories.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </FilterSelect>
                <FilterSelect label="Status" value={status} onChange={setStatus}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="all">All</option>
                </FilterSelect>
              </>
            }
          />
        </Card>
      ) : (
        <Card>
          <CardHeader title="All contracts" description="Across all projects" />
          <ContractsTable />
        </Card>
      )}
      {form && <ContractorForm contractor={form.contractor} onClose={() => setForm(null)} />}
      {contractForm && <ContractForm onClose={() => setContractForm(false)} onSaved={(id) => router.push(`/contractors/contracts/${id}`)} />}
      {payForm && <ContractorPaymentForm onClose={() => setPayForm(false)} />}
    </>
  );
}

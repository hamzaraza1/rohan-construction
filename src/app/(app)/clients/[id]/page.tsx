"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowDownLeft, Building2, FileSignature, Mail, MapPin, Pencil, Phone, Plus, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import { projectFinancials, sum } from "@/lib/calculations";
import { formatDate, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, DetailList, StatCard } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClientForm, ClientPaymentForm } from "@/components/forms/clients";
import { ProjectSummaryTable, useProjectRows } from "@/components/domain/ProjectTable";
import { ClientPaymentsTable } from "@/components/domain/Tables";

export default function ClientPage() {
  const { id } = useParams<{ id: string }>();
  const { data, canEdit } = useStore();
  const [edit, setEdit] = useState(false);
  const [pay, setPay] = useState(false);
  const c = data.clients.find((x) => x.id === id);
  const projects = useMemo(() => data.projects.filter((p) => p.clientId === id), [data, id]);
  const rows = useProjectRows(projects);
  const fins = projects.map((p) => projectFinancials(data, p.id));

  if (!c) return <Card><EmptyState title="Client not found" action={<ButtonLink href="/clients" variant="secondary">Back to clients</ButtonLink>} /></Card>;

  const contract = sum(projects, (p) => p.contractValue);
  const received = sum(fins, (f) => f.received);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Clients", href: "/clients" }, { label: c.name }]}
        title={c.name}
        meta={
          <>
            <span className="flex items-center gap-1.5"><Phone className="size-4 text-slate-400" />{c.phone}</span>
            {c.email && <span className="flex items-center gap-1.5"><Mail className="size-4 text-slate-400" />{c.email}</span>}
            {c.address && <span className="flex items-center gap-1.5"><MapPin className="size-4 text-slate-400" />{c.address}</span>}
          </>
        }
        actions={
          canEdit && (
            <>
              <Button variant="secondary" onClick={() => setEdit(true)}><Pencil className="size-4" /> Edit</Button>
              {projects.length > 0 && <Button variant="secondary" onClick={() => setPay(true)}><ArrowDownLeft className="size-4" /> Record payment</Button>}
              <ButtonLink href="/projects/new"><Plus className="size-4" /> New project</ButtonLink>
            </>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Projects" value={projects.length} hint={`${projects.filter((p) => p.status === "ACTIVE").length} active`} icon={<Building2 className="size-5" />} tone="brand" />
        <StatCard label="Total contract value" value={formatMoney(contract)} icon={<FileSignature className="size-5" />} />
        <StatCard label="Received" value={formatMoney(received)} icon={<ArrowDownLeft className="size-5" />} tone="positive" />
        <StatCard label="Balance due" value={formatMoney(contract - received)} icon={<Wallet className="size-5" />} tone={contract - received > 0 ? "warning" : "default"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Projects" />
          {rows.length ? <ProjectSummaryTable rows={rows} search={false} /> : <EmptyState title="No projects for this client yet" />}
        </Card>
        <Card>
          <CardHeader title="Client details" />
          <DetailList items={[["Phone", c.phone], ["Email", c.email], ["CNIC", c.cnic], ["Address", c.address], ["Client since", formatDate(c.createdAt)], ["Notes", c.notes]]} />
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Payment history" description="All payments received from this client, across projects" />
        <ClientPaymentsTable clientId={c.id} />
      </Card>

      {edit && <ClientForm client={c} onClose={() => setEdit(false)} />}
      {pay && <ClientPaymentForm projectId={projects.length === 1 ? projects[0].id : undefined} onClose={() => setPay(false)} />}
    </>
  );
}

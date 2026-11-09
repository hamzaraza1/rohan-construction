import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MapPin, Pencil, Phone, Plus } from "lucide-react";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/guards";
import { getClient } from "@/lib/queries/clients";
import { listClientPayments } from "@/lib/queries/projects";
import { setClientArchived } from "@/lib/actions/clients";
import { formatDate, formatMoney } from "@/lib/format";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { ProjectStatusBadge, ProjectTypeBadge } from "@/components/domain/badges";
import { ArchiveButton } from "@/components/domain/ArchiveButton";
import { ClientPaymentsTable } from "@/components/domain/ClientPaymentsTable";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const c = await getClient((await params).id);
  return { title: c?.name ?? "Client" };
}

export default async function ClientPage({ params }: Params) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  const payments = await listClientPayments({ project: { clientId: id } }, 1000);

  const zero = new Prisma.Decimal(0);
  const received = client.projects.reduce((a, p) => a.plus(p.summary.clientReceipts), zero);
  const due = client.projects.reduce((a, p) => (p.summary.clientAmountDue?.isPositive() ? a.plus(p.summary.clientAmountDue) : a), zero);
  const billable = client.projects.reduce((a, p) => (p.summary.clientBillable ? a.plus(p.summary.clientBillable) : a), zero);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500"><Link href="/clients" className="hover:underline">Clients</Link> /</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
            {client.name} {client.archivedAt && <Badge tone="red">Archived</Badge>}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
            <span className="flex items-center gap-1.5"><Phone className="size-4 text-slate-400" /> {client.phone}</span>
            {client.email && <span className="flex items-center gap-1.5"><Mail className="size-4 text-slate-400" /> {client.email}</span>}
            {client.address && <span className="flex items-center gap-1.5"><MapPin className="size-4 text-slate-400" /> {client.address}</span>}
          </div>
          {client.notes && <p className="mt-2 max-w-2xl text-sm whitespace-pre-line text-slate-500">{client.notes}</p>}
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            {!client.archivedAt && <ButtonLink href={`/projects/new?clientId=${id}`}><Plus className="size-4" /> New project</ButtonLink>}
            <ButtonLink href={`/clients/${id}/edit`} variant="secondary"><Pencil className="size-4" /> Edit</ButtonLink>
            <ArchiveButton action={setClientArchived.bind(null, id, !client.archivedAt)} archived={Boolean(client.archivedAt)} what="client" />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total payments received" value={formatMoney(received)} hint={`Across ${client.projects.length} project(s)`} />
        <StatCard label="Billable so far" value={billable.isZero() ? "—" : formatMoney(billable)} hint="Agreed values + commission projects' cost and commission" />
        <StatCard label="Still to pay" value={formatMoney(due)} tone={due.isZero() ? "default" : "warning"} />
      </div>

      <Card className="mt-6">
        <CardHeader title="Projects" />
        {client.projects.length === 0 ? (
          <EmptyState title="No projects for this client yet" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Project</TH>
                <TH>Type</TH>
                <TH>Status</TH>
                <TH>Started</TH>
                <TH numeric>Billable</TH>
                <TH numeric>Received</TH>
                <TH numeric>Still to pay</TH>
              </tr>
            </THead>
            <TBody>
              {client.projects.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link href={`/projects/${p.id}`} className="font-medium text-brand-700 hover:underline">{p.name}</Link>
                    {p.archivedAt && <span className="ml-2"><Badge tone="red">Archived</Badge></span>}
                    <div className="text-xs text-slate-500">{p.siteAddress}</div>
                  </TD>
                  <TD><ProjectTypeBadge type={p.type} commission={p.summary.commissionPercent} /></TD>
                  <TD><ProjectStatusBadge status={p.status} /></TD>
                  <TD>{formatDate(p.startDate)}</TD>
                  <TD numeric>{p.summary.clientBillable ? formatMoney(p.summary.clientBillable) : "—"}</TD>
                  <TD numeric className="font-medium">{formatMoney(p.summary.clientReceipts)}</TD>
                  <TD numeric>
                    {p.summary.clientAmountDue == null ? (
                      "—"
                    ) : p.summary.clientAmountDue.isNegative() ? (
                      <span className="text-emerald-700">{formatMoney(p.summary.clientAmountDue.abs())} ahead</span>
                    ) : (
                      <span className={p.summary.clientAmountDue.isZero() ? "" : "text-amber-700"}>{formatMoney(p.summary.clientAmountDue)}</span>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="Payment history" description="All payments received from this client, across projects" />
        {payments.length === 0 ? (
          <EmptyState title="No payments received yet" />
        ) : (
          <ClientPaymentsTable payments={payments} isAdmin={isAdmin} showProject />
        )}
      </Card>
    </>
  );
}

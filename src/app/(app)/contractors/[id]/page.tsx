import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Pencil, Phone, Wrench } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getContractor, listContractorPayments } from "@/lib/queries/contractors";
import { setContractorArchived } from "@/lib/actions/contractors";
import { formatMoney } from "@/lib/format";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { ArchiveButton } from "@/components/domain/ArchiveButton";
import { ContractsTable } from "@/components/domain/ContractsTable";
import { ContractorPaymentsTable } from "@/components/domain/ContractorPaymentsTable";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const c = await getContractor((await params).id);
  return { title: c?.name ?? "Contractor" };
}

export default async function ContractorPage({ params }: Params) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const { id } = await params;
  const c = await getContractor(id);
  if (!c) notFound();
  const payments = await listContractorPayments({ contract: { contractorId: id } });
  const projects = new Set(c.contracts.filter((k) => !k.voidedAt).map((k) => k.projectId));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500"><Link href="/contractors" className="hover:underline">Contractors</Link> /</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
            {c.name} {c.archivedAt && <Badge tone="red">Archived</Badge>}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
            <span className="flex items-center gap-1.5"><Phone className="size-4 text-slate-400" /> {c.phone}</span>
            {c.specialization && <span className="flex items-center gap-1.5"><Wrench className="size-4 text-slate-400" /> {c.specialization}</span>}
            {c.address && <span className="flex items-center gap-1.5"><MapPin className="size-4 text-slate-400" /> {c.address}</span>}
          </div>
          {c.notes && <p className="mt-2 max-w-2xl text-sm whitespace-pre-line text-slate-500">{c.notes}</p>}
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/contractors/${id}/edit`} variant="secondary"><Pencil className="size-4" /> Edit</ButtonLink>
            <ArchiveButton action={setContractorArchived.bind(null, id, !c.archivedAt)} archived={Boolean(c.archivedAt)} what="contractor" />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total contract amounts" value={formatMoney(c.totals.netPayable)} hint={`Incl. extras/deductions · ${projects.size} project(s)`} />
        <StatCard label="Total payments made" value={formatMoney(c.totals.paid)} />
        <StatCard label="Remaining payable" value={formatMoney(c.totals.outstanding)} tone={c.totals.outstanding.isZero() ? "default" : "warning"} />
        <StatCard label="Overpaid / advance" value={formatMoney(c.totals.overpaid)} tone={c.totals.overpaid.isZero() ? "default" : "warning"} hint="Paid beyond contract value" />
      </div>

      <Card className="mt-6">
        <CardHeader title="Contract history" description="New contracts are created from a project's Contractors tab." />
        {c.contracts.length === 0 ? (
          <EmptyState title="No contracts yet" />
        ) : (
          <ContractsTable contracts={c.contracts} balances={c.balances} show="project" />
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="Payment history" />
        {payments.length === 0 ? <EmptyState title="No payments yet" /> : <ContractorPaymentsTable payments={payments} isAdmin={isAdmin} showContract />}
      </Card>
    </>
  );
}

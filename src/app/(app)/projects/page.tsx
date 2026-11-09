import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { ProjectStatus, ProjectType } from "@prisma/client";
import { requireUser } from "@/lib/auth/guards";
import { listProjects } from "@/lib/queries/projects";
import { formatDate, formatMoney, PROJECT_STATUS_LABELS, PROJECT_TYPE_LABELS } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { ProjectStatusBadge, ProjectTypeBadge } from "@/components/domain/badges";

export const metadata: Metadata = { title: "Projects" };

const isStatus = (v?: string): v is ProjectStatus => !!v && v in PROJECT_STATUS_LABELS;
const isType = (v?: string): v is ProjectType => !!v && v in PROJECT_TYPE_LABELS;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const archived = sp.archived === "1";
  const projects = await listProjects({
    q: sp.q?.trim() || undefined,
    status: isStatus(sp.status) ? sp.status : undefined,
    type: isType(sp.type) ? sp.type : undefined,
    archived,
  });
  const filtered = Boolean(sp.q || sp.status || sp.type);

  return (
    <>
      <PageHeader
        title={archived ? "Archived projects" : "Projects"}
        description="Every project keeps its own separate financial records."
        actions={
          user.role === "ADMIN" && (
            <ButtonLink href="/projects/new"><Plus className="size-4" /> New project</ButtonLink>
          )
        }
      />
      <Card>
        <form className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          {archived && <input type="hidden" name="archived" value="1" />}
          <Input name="q" defaultValue={sp.q} placeholder="Search project, site or client…" className="min-w-56 flex-1" aria-label="Search" />
          <Select name="type" defaultValue={sp.type ?? ""} className="w-48" aria-label="Contract type">
            <option value="">All contract types</option>
            {Object.entries(PROJECT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select name="status" defaultValue={sp.status ?? ""} className="w-40" aria-label="Status">
            <option value="">All statuses</option>
            {Object.entries(PROJECT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Button type="submit" variant="secondary">Filter</Button>
          {filtered && <ButtonLink href={archived ? "/projects?archived=1" : "/projects"} variant="ghost">Clear</ButtonLink>}
          <Link href={archived ? "/projects" : "/projects?archived=1"} className="ml-auto text-sm text-brand-700 hover:underline">
            {archived ? "← Active list" : "Archived projects"}
          </Link>
        </form>
        {projects.length === 0 ? (
          <EmptyState
            title={filtered ? "No projects match these filters" : archived ? "No archived projects" : "No projects yet"}
            description={!filtered && !archived ? "Create the first project to start tracking its payments and expenses." : undefined}
            action={!filtered && !archived && user.role === "ADMIN" ? <ButtonLink href="/projects/new">New project</ButtonLink> : undefined}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Project</TH>
                <TH>Contract type</TH>
                <TH>Status</TH>
                <TH>Started</TH>
                <TH numeric>Received</TH>
                <TH numeric>Actual cost</TH>
                <TH numeric>Cash balance</TH>
              </tr>
            </THead>
            <TBody>
              {projects.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link href={`/projects/${p.id}`} className="font-medium text-brand-700 hover:underline">{p.name}</Link>
                    <div className="text-xs text-slate-500">{p.client.name} · {p.siteAddress}</div>
                  </TD>
                  <TD><ProjectTypeBadge type={p.type} commission={p.commissionPercent} /></TD>
                  <TD><ProjectStatusBadge status={p.status} /></TD>
                  <TD>{formatDate(p.startDate)}</TD>
                  <TD numeric>{formatMoney(p.summary.clientReceipts)}</TD>
                  <TD numeric>{formatMoney(p.summary.projectCost)}</TD>
                  <TD numeric className={p.summary.cashBalance.isNegative() ? "font-semibold text-red-700" : "font-semibold"}>
                    {formatMoney(p.summary.cashBalance)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}

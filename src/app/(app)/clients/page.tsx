import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { listClients } from "@/lib/queries/clients";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const archived = sp.archived === "1";
  const q = sp.q?.trim() || undefined;
  const clients = await listClients(q, archived);

  return (
    <>
      <PageHeader
        title={archived ? "Archived clients" : "Clients"}
        description="Client profiles, their projects and payments received."
        actions={user.role === "ADMIN" && <ButtonLink href="/clients/new"><Plus className="size-4" /> New client</ButtonLink>}
      />
      <Card>
        <form className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          {archived && <input type="hidden" name="archived" value="1" />}
          <Input name="q" defaultValue={q} placeholder="Search name, phone or email…" className="min-w-56 flex-1" aria-label="Search clients" />
          <Button type="submit" variant="secondary">Search</Button>
          {q && <ButtonLink href={archived ? "/clients?archived=1" : "/clients"} variant="ghost">Clear</ButtonLink>}
          <Link href={archived ? "/clients" : "/clients?archived=1"} className="ml-auto text-sm text-brand-700 hover:underline">
            {archived ? "← Active clients" : "Archived clients"}
          </Link>
        </form>
        {clients.length === 0 ? (
          <EmptyState
            title={q ? "No clients match your search" : archived ? "No archived clients" : "No clients yet"}
            action={!q && !archived && user.role === "ADMIN" ? <ButtonLink href="/clients/new">New client</ButtonLink> : undefined}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Client</TH>
                <TH>Phone</TH>
                <TH numeric>Projects</TH>
                <TH numeric>Total received</TH>
                <TH numeric>Still to pay</TH>
              </tr>
            </THead>
            <TBody>
              {clients.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/clients/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.name}</Link>
                    {c.email && <div className="text-xs text-slate-500">{c.email}</div>}
                  </TD>
                  <TD>{c.phone}</TD>
                  <TD numeric>{c.projectCount}{c.activeProjects > 0 && <span className="text-xs text-slate-500"> ({c.activeProjects} active)</span>}</TD>
                  <TD numeric className="font-medium">{formatMoney(c.received)}</TD>
                  <TD numeric className={c.due.isZero() ? "text-slate-400" : "font-medium text-amber-700"}>{c.due.isZero() ? "—" : formatMoney(c.due)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <p className="mt-3 text-xs text-slate-500">
        &ldquo;Still to pay&rdquo; is shown for projects with an agreed contract value, and for commission projects (cost + commission − received).
      </p>
    </>
  );
}

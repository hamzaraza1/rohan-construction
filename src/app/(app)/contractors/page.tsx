import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { listContractors } from "@/lib/queries/contractors";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

export const metadata: Metadata = { title: "Contractors" };

export default async function ContractorsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const archived = sp.archived === "1";
  const q = sp.q?.trim() || undefined;
  const rows = await listContractors(q, archived);

  return (
    <>
      <PageHeader
        title={archived ? "Archived contractors" : "Contractors"}
        description="Contract amounts are commitments; only actual payments reduce cash."
        actions={user.role === "ADMIN" && <ButtonLink href="/contractors/new"><Plus className="size-4" /> New contractor</ButtonLink>}
      />
      <Card>
        <form className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          {archived && <input type="hidden" name="archived" value="1" />}
          <Input name="q" defaultValue={q} placeholder="Search name, phone or specialization…" className="min-w-56 flex-1" aria-label="Search contractors" />
          <Button type="submit" variant="secondary">Search</Button>
          {q && <ButtonLink href={archived ? "/contractors?archived=1" : "/contractors"} variant="ghost">Clear</ButtonLink>}
          <Link href={archived ? "/contractors" : "/contractors?archived=1"} className="ml-auto text-sm text-brand-700 hover:underline">
            {archived ? "← Active contractors" : "Archived contractors"}
          </Link>
        </form>
        {rows.length === 0 ? (
          <EmptyState
            title={q ? "No contractors match your search" : archived ? "No archived contractors" : "No contractors yet"}
            action={!q && !archived && user.role === "ADMIN" ? <ButtonLink href="/contractors/new">New contractor</ButtonLink> : undefined}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Contractor</TH>
                <TH>Phone</TH>
                <TH numeric>Contracts</TH>
                <TH numeric>Total contracted</TH>
                <TH numeric>Total paid</TH>
                <TH numeric>Remaining</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/contractors/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.name}</Link>
                    {c.specialization && <div className="text-xs text-slate-500">{c.specialization}</div>}
                  </TD>
                  <TD>{c.phone}</TD>
                  <TD numeric>{c.contracts.length}{c.activeContracts > 0 && <span className="text-xs text-slate-500"> ({c.activeContracts} active)</span>}</TD>
                  <TD numeric>{formatMoney(c.totals.netPayable)}</TD>
                  <TD numeric className="font-medium">{formatMoney(c.totals.paid)}</TD>
                  <TD numeric className={c.totals.outstanding.isZero() ? "text-slate-400" : "font-medium text-amber-700"}>
                    {c.totals.outstanding.isZero() ? "—" : formatMoney(c.totals.outstanding)}
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

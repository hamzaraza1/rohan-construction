import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { listSuppliers } from "@/lib/queries/suppliers";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const archived = sp.archived === "1";
  const q = sp.q?.trim() || undefined;
  const rows = await listSuppliers(q, archived);
  return (
    <>
      <PageHeader
        title={archived ? "Archived suppliers" : "Suppliers"}
        description="Orders are commitments, received material is cost, payments are cash. Each is tracked separately per project."
        actions={user.role === "ADMIN" && <ButtonLink href="/suppliers/new"><Plus className="size-4" /> New supplier</ButtonLink>}
      />
      <Card>
        <form className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          {archived && <input type="hidden" name="archived" value="1" />}
          <Input name="q" defaultValue={q} placeholder="Search name, phone or material category…" className="min-w-56 flex-1" aria-label="Search suppliers" />
          <Button type="submit" variant="secondary">Search</Button>
          {q && <ButtonLink href={archived ? "/suppliers?archived=1" : "/suppliers"} variant="ghost">Clear</ButtonLink>}
          <Link href={archived ? "/suppliers" : "/suppliers?archived=1"} className="ml-auto text-sm text-brand-700 hover:underline">
            {archived ? "← Active suppliers" : "Archived suppliers"}
          </Link>
        </form>
        {rows.length === 0 ? (
          <EmptyState
            title={q ? "No suppliers match your search" : archived ? "No archived suppliers" : "No suppliers yet"}
            action={!q && !archived && user.role === "ADMIN" ? <ButtonLink href="/suppliers/new">New supplier</ButtonLink> : undefined}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Supplier</TH>
                <TH>Contact</TH>
                <TH numeric>Received</TH>
                <TH numeric>Paid</TH>
                <TH numeric>Advance balance</TH>
                <TH numeric>Payable</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((s) => (
                <TR key={s.id}>
                  <TD>
                    <Link href={`/suppliers/${s.id}`} className="font-medium text-brand-700 hover:underline">{s.name}</Link>
                    {s.categories.length > 0 && <div className="text-xs text-slate-500">{s.categories.map((c) => c.name).join(", ")}</div>}
                  </TD>
                  <TD>{s.phone}</TD>
                  <TD numeric>{formatMoney(s.totals.receivedValue)}</TD>
                  <TD numeric>{formatMoney(s.totals.paid)}</TD>
                  <TD numeric className={s.totals.advanceBalance.isZero() ? "text-slate-400" : "text-sky-700"}>{formatMoney(s.totals.advanceBalance)}</TD>
                  <TD numeric className={s.totals.outstandingPayable.isZero() ? "text-slate-400" : "font-semibold text-amber-700"}>{formatMoney(s.totals.outstandingPayable)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <p className="mt-3 text-xs text-slate-500">
        Balances are kept per project: an advance paid for one site is never set off against material delivered to another site.
      </p>
    </>
  );
}

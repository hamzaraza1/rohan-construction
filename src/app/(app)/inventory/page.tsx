import type { Metadata } from "next";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/guards";
import { stockByProject } from "@/lib/queries/inventory";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage() {
  await requireUser();
  const rows = await stockByProject();
  const total = rows.reduce((a, r) => a.plus(r.stockValue), new Prisma.Decimal(0));
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Every site keeps its own stock. There is no central warehouse and no site-to-site transfer."
        actions={<ButtonLink href="/inventory/materials" variant="secondary">Materials catalogue</ButtonLink>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Stock value on all sites" value={formatMoney(total)} hint="Remaining quantity × average received rate" />
        <StatCard label="Sites with stock" value={String(rows.filter((r) => r.materials > 0).length)} />
      </div>
      <Card>
        <CardHeader title="Stock by site" description="Open a site to see its materials, and to record issues, wastage and stock corrections." />
        {rows.length === 0 ? (
          <EmptyState title="No projects yet" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Site</TH>
                <TH numeric>Materials in stock</TH>
                <TH numeric>Total received (value)</TH>
                <TH numeric>Current stock value</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.projectId}>
                  <TD><Link href={`/projects/${r.projectId}?tab=inventory`} className="font-medium text-brand-700 hover:underline">{r.projectName}</Link></TD>
                  <TD numeric>{r.materials}</TD>
                  <TD numeric>{formatMoney(r.receivedValue)}</TD>
                  <TD numeric className="font-medium">{formatMoney(r.stockValue)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Pencil, Phone } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getSupplier, listPurchaseOrders, listReceipts, listSupplierPayments } from "@/lib/queries/suppliers";
import { setSupplierArchived } from "@/lib/actions/suppliers";
import { formatMoney } from "@/lib/format";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { ArchiveButton } from "@/components/domain/ArchiveButton";
import { PurchaseOrdersTable, ReceiptsTable, SupplierAccountsTable, SupplierPaymentsTable } from "@/components/domain/SupplyTables";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const s = await getSupplier((await params).id);
  return { title: s?.name ?? "Supplier" };
}

export default async function SupplierPage({ params }: Params) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const { id } = await params;
  const s = await getSupplier(id);
  if (!s) notFound();
  const [orders, receipts, payments] = await Promise.all([
    listPurchaseOrders({ supplierId: id }),
    listReceipts({ supplierId: id }),
    listSupplierPayments({ supplierId: id }),
  ]);
  const t = s.totals;
  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500"><Link href="/suppliers" className="hover:underline">Suppliers</Link> /</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
            {s.name} {s.archivedAt && <Badge tone="red">Archived</Badge>}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
            <span className="flex items-center gap-1.5"><Phone className="size-4 text-slate-400" /> {s.phone}</span>
            {s.address && <span className="flex items-center gap-1.5"><MapPin className="size-4 text-slate-400" /> {s.address}</span>}
          </div>
          {s.categories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">{s.categories.map((c) => <Badge key={c.id}>{c.name}</Badge>)}</div>
          )}
          {s.notes && <p className="mt-2 max-w-2xl text-sm whitespace-pre-line text-slate-500">{s.notes}</p>}
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/suppliers/${id}/edit`} variant="secondary"><Pencil className="size-4" /> Edit</ButtonLink>
            <ArchiveButton action={setSupplierArchived.bind(null, id, !s.archivedAt)} archived={Boolean(s.archivedAt)} what="supplier" />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total order value" value={formatMoney(t.orderedValue)} hint="Commitments (not cash)" />
        <StatCard label="Material received" value={formatMoney(t.receivedValue)} hint="Counted as project cost" />
        <StatCard label="Total paid" value={formatMoney(t.paid)} hint="Advances + payments" />
        <StatCard label="Advance balance" value={formatMoney(t.advanceBalance)} hint="Paid but material not yet received" />
        <StatCard label="Outstanding payable" value={formatMoney(t.outstandingPayable)} tone={t.outstandingPayable.isZero() ? "default" : "warning"} hint="Material received, not yet paid" />
        <StatCard label="Undelivered orders" value={formatMoney(t.undeliveredValue)} hint="Still to be delivered on open orders" />
      </div>

      <Card className="mt-6">
        <CardHeader title="Balances by project" description="New orders, receipts and payments are entered from each project's Suppliers tab." />
        {s.accounts.length === 0 ? (
          <EmptyState title="No transactions with this supplier yet" />
        ) : (
          <SupplierAccountsTable
            label="Project"
            rows={s.accounts.map((a) => ({ ...a, key: a.projectId, name: a.projectName, href: `/projects/${a.projectId}?tab=suppliers` }))}
          />
        )}
      </Card>

      {orders.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Purchase orders" />
          <PurchaseOrdersTable orders={orders} show="project" />
        </Card>
      )}
      <Card className="mt-6">
        <CardHeader title="Material received" />
        {receipts.length === 0 ? <EmptyState title="No deliveries yet" /> : <ReceiptsTable receipts={receipts} show="project" />}
      </Card>
      <Card className="mt-6">
        <CardHeader title="Payment history" />
        {payments.length === 0 ? <EmptyState title="No payments yet" /> : <SupplierPaymentsTable payments={payments} isAdmin={isAdmin} show="project" />}
      </Card>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus, Truck } from "lucide-react";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/guards";
import { getPurchaseOrder, listReceipts } from "@/lib/queries/suppliers";
import { setPurchaseOrderStatus } from "@/lib/actions/purchasing";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmSubmit } from "@/components/ui/ConfirmDialog";
import { PoStatusBadge, ReceiptsTable, SupplierPaymentsTable } from "@/components/domain/SupplyTables";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const po = await getPurchaseOrder((await params).id);
  return { title: po ? `PO-${po.orderNumber}` : "Purchase order" };
}

export default async function PurchaseOrderPage({ params }: Params) {
  const user = await requireUser();
  const { id } = await params;
  const po = await getPurchaseOrder(id);
  if (!po) notFound();
  const receipts = await listReceipts({ purchaseOrderId: id });
  const canWrite = user.role === "ADMIN" && !po.project.archivedAt;
  const open = po.status === "OPEN";
  const ZERO = new Prisma.Decimal(0);
  const ordered = po.lines.reduce((a, l) => a.plus(l.orderedValue), ZERO);
  const received = po.lines.reduce((a, l) => a.plus(l.receivedValue), ZERO);
  const undelivered = po.lines.reduce((a, l) => a.plus(l.undeliveredValue), ZERO);
  const paid = po.payments.filter((p) => !p.voidedAt).reduce((a, p) => a.plus(p.amount), ZERO);
  const activeReceipts = receipts.filter((r) => !r.voidedAt).length;
  const hasActivity = activeReceipts > 0 || po.payments.some((p) => !p.voidedAt);
  const qs = `projectId=${po.projectId}&supplierId=${po.supplierId}&poId=${po.id}`;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            <Link href={`/projects/${po.projectId}?tab=suppliers`} className="hover:underline">{po.project.name}</Link> / Purchase orders /
          </p>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold tracking-tight text-slate-900">
            PO-{po.orderNumber} <PoStatusBadge status={po.status} />
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Supplier: <Link href={`/suppliers/${po.supplierId}`} className="font-medium text-brand-700 hover:underline">{po.supplier.name}</Link>
            {" · "}Ordered {formatDate(po.orderDate)}
            {po.expectedDate && ` · Expected ${formatDate(po.expectedDate)}`}
          </p>
          {po.notes && <p className="mt-1 max-w-2xl text-sm whitespace-pre-line text-slate-500">{po.notes}</p>}
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            {open && <ButtonLink href={`/receipts/new?${qs}`}><Truck className="size-4" /> Receive material</ButtonLink>}
            {po.status !== "CANCELLED" && (
              <ButtonLink href={`/supplier-payments/new?${qs}`} variant="secondary"><Plus className="size-4" /> Pay supplier</ButtonLink>
            )}
            {open && activeReceipts === 0 && receipts.length === 0 && (
              <ButtonLink href={`/purchase-orders/${id}/edit`} variant="secondary"><Pencil className="size-4" /> Edit</ButtonLink>
            )}
            {open && (
              <ActionForm action={setPurchaseOrderStatus.bind(null, id, "CLOSED")} showSuccess={false}>
                <ConfirmSubmit
                  size="md"
                  variant="secondary"
                  label="Close order"
                  title={`Close PO-${po.orderNumber}?`}
                  message={`No further deliveries are expected. The undelivered value (${formatMoney(undelivered)}) stops counting as an open commitment. Any advance not covered by deliveries stays as a supplier advance balance.`}
                  confirmLabel="Close order"
                />
              </ActionForm>
            )}
            {po.status === "CLOSED" && (
              <ActionForm action={setPurchaseOrderStatus.bind(null, id, "OPEN")} showSuccess={false}>
                <ConfirmSubmit size="md" variant="secondary" label="Reopen" title="Reopen this order?" message="It will accept deliveries again." confirmLabel="Reopen" />
              </ActionForm>
            )}
            {open && !hasActivity && (
              <ActionForm action={setPurchaseOrderStatus.bind(null, id, "CANCELLED")} showSuccess={false}>
                <ConfirmSubmit size="md" variant="ghost" label="Cancel order" title="Cancel this order?" message="Use this for an order that will not go ahead. It cannot be reopened." confirmLabel="Cancel order" />
              </ActionForm>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Order value" value={formatMoney(ordered)} hint="Commitment only" />
        <StatCard label="Material received" value={formatMoney(received)} />
        <StatCard label="Paid against this order" value={formatMoney(paid)} />
        <StatCard label="Undelivered value" value={formatMoney(undelivered)} hint={open ? undefined : "Released (order not open)"} />
      </div>

      <Card className="mt-6">
        <CardHeader title="Order lines" />
        <Table>
          <THead>
            <tr>
              <TH>Material</TH>
              <TH numeric>Ordered</TH>
              <TH numeric>Received</TH>
              <TH numeric>Remaining</TH>
              <TH numeric>Rate</TH>
              <TH numeric>Order value</TH>
              <TH numeric>Received value</TH>
            </tr>
          </THead>
          <TBody>
            {po.lines.map((l) => (
              <TR key={l.id}>
                <TD className="font-medium">{l.material.name}</TD>
                <TD numeric>{formatNumber(l.quantity)} {l.material.unit}</TD>
                <TD numeric>{formatNumber(l.receivedQty)}</TD>
                <TD numeric className={l.remainingQty.greaterThan(0) && open ? "text-amber-700" : "text-slate-400"}>{formatNumber(l.remainingQty)}</TD>
                <TD numeric>{formatMoney(l.rate)}</TD>
                <TD numeric>{formatMoney(l.orderedValue)}</TD>
                <TD numeric>{formatMoney(l.receivedValue)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Deliveries against this order" />
        {receipts.length === 0 ? <EmptyState title="Nothing received yet" /> : <ReceiptsTable receipts={receipts} show="supplier" />}
      </Card>
      <Card className="mt-6">
        <CardHeader title="Payments linked to this order" />
        {po.payments.length === 0 ? (
          <EmptyState title="No payments linked to this order" />
        ) : (
          <SupplierPaymentsTable
            payments={po.payments.map((p) => ({ ...p, supplier: po.supplier, project: po.project, purchaseOrder: { id: po.id, orderNumber: po.orderNumber } }))}
            isAdmin={canWrite}
            show="supplier"
          />
        )}
      </Card>
    </>
  );
}

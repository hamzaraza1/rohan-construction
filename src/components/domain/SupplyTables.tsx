import Link from "next/link";
import { Paperclip } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { formatDate, formatMoney, PAYMENT_METHOD_LABELS } from "@/lib/format";
import { voidSupplierPayment } from "@/lib/actions/purchasing";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { VoidDialog } from "./VoidDialog";

type Dec = Prisma.Decimal;

export function PoStatusBadge({ status }: { status: "OPEN" | "CLOSED" | "CANCELLED" }) {
  return status === "OPEN" ? <Badge tone="green">Open</Badge> : status === "CLOSED" ? <Badge tone="slate">Closed</Badge> : <Badge tone="red">Cancelled</Badge>;
}

/** Per project/supplier account: the six figures the requirements ask for. */
export function SupplierAccountsTable({
  rows,
  label,
}: {
  rows: { key: string; name: string; href: string; orderedValue: Dec; receivedValue: Dec; paid: Dec; advanceBalance: Dec; outstandingPayable: Dec; undeliveredValue: Dec }[];
  label: string;
}) {
  return (
    <Table>
      <THead>
        <tr>
          <TH>{label}</TH>
          <TH numeric>Ordered</TH>
          <TH numeric>Received</TH>
          <TH numeric>Paid</TH>
          <TH numeric>Advance balance</TH>
          <TH numeric>Payable</TH>
          <TH numeric>Undelivered</TH>
        </tr>
      </THead>
      <TBody>
        {rows.map((r) => (
          <TR key={r.key}>
            <TD><Link href={r.href} className="font-medium text-brand-700 hover:underline">{r.name}</Link></TD>
            <TD numeric>{formatMoney(r.orderedValue)}</TD>
            <TD numeric>{formatMoney(r.receivedValue)}</TD>
            <TD numeric>{formatMoney(r.paid)}</TD>
            <TD numeric className={r.advanceBalance.isZero() ? "text-slate-400" : "text-sky-700"}>{formatMoney(r.advanceBalance)}</TD>
            <TD numeric className={r.outstandingPayable.isZero() ? "text-slate-400" : "font-semibold text-amber-700"}>{formatMoney(r.outstandingPayable)}</TD>
            <TD numeric className={r.undeliveredValue.isZero() ? "text-slate-400" : ""}>{formatMoney(r.undeliveredValue)}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

export function PurchaseOrdersTable({
  orders,
  show,
}: {
  orders: { id: string; orderNumber: number; orderDate: Date; status: "OPEN" | "CLOSED" | "CANCELLED"; supplier: { name: string }; project: { name: string }; orderedValue: Dec; receivedValue: Dec; undeliveredValue: Dec; paidAgainst: Dec }[];
  show: "supplier" | "project";
}) {
  return (
    <Table>
      <THead>
        <tr>
          <TH>Order</TH>
          <TH>Date</TH>
          <TH>{show === "supplier" ? "Supplier" : "Project"}</TH>
          <TH>Status</TH>
          <TH numeric>Order value</TH>
          <TH numeric>Received</TH>
          <TH numeric>Paid against order</TH>
          <TH numeric>Undelivered</TH>
        </tr>
      </THead>
      <TBody>
        {orders.map((o) => (
          <TR key={o.id}>
            <TD><Link href={`/purchase-orders/${o.id}`} className="font-medium text-brand-700 hover:underline">PO-{o.orderNumber}</Link></TD>
            <TD>{formatDate(o.orderDate)}</TD>
            <TD>{show === "supplier" ? o.supplier.name : o.project.name}</TD>
            <TD><PoStatusBadge status={o.status} /></TD>
            <TD numeric>{formatMoney(o.orderedValue)}</TD>
            <TD numeric>{formatMoney(o.receivedValue)}</TD>
            <TD numeric>{formatMoney(o.paidAgainst)}</TD>
            <TD numeric>{formatMoney(o.undeliveredValue)}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

export function ReceiptsTable({
  receipts,
  show,
}: {
  receipts: { id: string; receiptDate: Date; challanNumber: string | null; voidedAt: Date | null; supplier: { name: string }; project: { name: string }; purchaseOrder: { id: string; orderNumber: number } | null; lines: { material: { name: string } }[]; value: Dec; attachment: { id: string } | null }[];
  show: "supplier" | "project";
}) {
  return (
    <Table>
      <THead>
        <tr>
          <TH>Date</TH>
          <TH>{show === "supplier" ? "Supplier" : "Project"}</TH>
          <TH>Order</TH>
          <TH>Materials</TH>
          <TH>Challan</TH>
          <TH numeric>Value received</TH>
        </tr>
      </THead>
      <TBody>
        {receipts.map((r) => {
          const dim = r.voidedAt ? "text-slate-400" : undefined;
          return (
            <TR key={r.id}>
              <TD><Link href={`/receipts/${r.id}`} className={r.voidedAt ? "text-slate-400 line-through" : "font-medium text-brand-700 hover:underline"}>{formatDate(r.receiptDate)}</Link></TD>
              <TD className={dim}>{show === "supplier" ? r.supplier.name : r.project.name}</TD>
              <TD className={dim}>{r.purchaseOrder ? `PO-${r.purchaseOrder.orderNumber}` : "Direct"}</TD>
              <TD className={`max-w-xs truncate ${dim ?? ""}`}>{r.lines.map((l) => l.material.name).join(", ")}</TD>
              <TD className={dim}>
                {r.challanNumber ?? "—"}
                {r.attachment && <Paperclip className="ml-1 inline size-3.5 text-slate-400" aria-label="has attachment" />}
                {r.voidedAt && <span className="ml-2"><Badge tone="red">Voided</Badge></span>}
              </TD>
              <TD numeric className={r.voidedAt ? "text-slate-400 line-through" : "font-medium"}>{formatMoney(r.value)}</TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}

export function SupplierPaymentsTable({
  payments,
  isAdmin,
  show,
}: {
  payments: { id: string; type: "ADVANCE" | "PAYMENT"; amount: Dec; date: Date; method: "CASH" | "BANK_TRANSFER"; reference: string | null; description: string | null; voidedAt: Date | null; voidReason: string | null; supplier: { name: string }; project: { name: string }; purchaseOrder: { id: string; orderNumber: number } | null; attachment: { id: string; originalName: string } | null }[];
  isAdmin: boolean;
  show: "supplier" | "project";
}) {
  return (
    <Table>
      <THead>
        <tr>
          <TH>Date</TH>
          <TH>{show === "supplier" ? "Supplier" : "Project"}</TH>
          <TH>Type</TH>
          <TH>Method</TH>
          <TH>Details</TH>
          <TH numeric>Amount</TH>
          <TH className="w-px"><span className="sr-only">Actions</span></TH>
        </tr>
      </THead>
      <TBody>
        {payments.map((p) => {
          const voided = Boolean(p.voidedAt);
          const dim = voided ? "text-slate-400" : undefined;
          return (
            <TR key={p.id} className={voided ? "bg-slate-50/60" : undefined}>
              <TD className={dim}>{formatDate(p.date)}</TD>
              <TD className={dim}>{show === "supplier" ? p.supplier.name : p.project.name}</TD>
              <TD>{p.type === "ADVANCE" ? <Badge tone="blue">Advance</Badge> : <Badge tone="slate">Payment</Badge>}</TD>
              <TD className={dim}>{PAYMENT_METHOD_LABELS[p.method]}</TD>
              <TD className="max-w-xs whitespace-normal">
                <span className={dim}>{[p.purchaseOrder && `PO-${p.purchaseOrder.orderNumber}`, p.reference, p.description].filter(Boolean).join(" · ")}</span>
                {p.attachment && (
                  <a href={`/api/attachments/${p.attachment.id}`} target="_blank" rel="noopener" className="ml-2 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
                    <Paperclip className="size-3.5" /> Receipt
                  </a>
                )}
                {voided && <div className="mt-1"><Badge tone="red">Voided</Badge> <span className="text-xs text-slate-500">{p.voidReason}</span></div>}
              </TD>
              <TD numeric className={voided ? "text-slate-400 line-through" : "font-medium text-slate-900"}>{formatMoney(p.amount)}</TD>
              <TD className="whitespace-nowrap">
                {isAdmin && !voided && (
                  <div className="flex justify-end gap-1">
                    <Link href={`/supplier-payments/${p.id}/edit`} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Edit</Link>
                    <VoidDialog
                      action={voidSupplierPayment.bind(null, p.id)}
                      title={`Void payment of ${formatMoney(p.amount)}?`}
                      description="It stays on record with your reason but no longer counts in cash or the supplier balance."
                    />
                  </div>
                )}
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}

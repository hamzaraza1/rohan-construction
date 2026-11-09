import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Paperclip } from "lucide-react";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/guards";
import { dbRead } from "@/lib/db";
import { voidReceipt } from "@/lib/actions/purchasing";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { VoidDialog } from "@/components/domain/VoidDialog";

export const metadata: Metadata = { title: "Material receipt" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const r = await dbRead.materialReceipt.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true, archivedAt: true } },
      supplier: { select: { id: true, name: true } },
      purchaseOrder: { select: { id: true, orderNumber: true } },
      lines: { include: { material: { select: { name: true, unit: true } } } },
      attachment: { select: { id: true, originalName: true } },
    },
  });
  if (!r) notFound();
  const total = r.lines.reduce((a, l) => a.plus(l.quantity.mul(l.rate).toDecimalPlaces(2)), new Prisma.Decimal(0));
  const canVoid = user.role === "ADMIN" && !r.voidedAt && !r.project.archivedAt;
  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            <Link href={`/projects/${r.project.id}?tab=suppliers`} className="hover:underline">{r.project.name}</Link> / Material received /
          </p>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold tracking-tight text-slate-900">
            Delivery of {formatDate(r.receiptDate)} {r.voidedAt && <Badge tone="red">Voided</Badge>}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Supplier: <Link href={`/suppliers/${r.supplier.id}`} className="font-medium text-brand-700 hover:underline">{r.supplier.name}</Link>
            {r.purchaseOrder ? (
              <> · Against <Link href={`/purchase-orders/${r.purchaseOrder.id}`} className="text-brand-700 hover:underline">PO-{r.purchaseOrder.orderNumber}</Link></>
            ) : " · Direct purchase (no order)"}
            {r.challanNumber && ` · Challan ${r.challanNumber}`}
          </p>
          {r.voidedAt && <p className="mt-1 text-sm text-red-700">Voided {formatDateTime(r.voidedAt)}: {r.voidReason}</p>}
        </div>
        {canVoid && (
          <VoidDialog
            action={voidReceipt.bind(null, id)}
            title="Void this receipt?"
            description="The material is removed from site stock and from project cost, and the supplier balance is recalculated. Not allowed if the material has already been issued (stock would go negative). Receipts cannot be edited: void and enter again."
          />
        )}
      </div>
      <Card>
        <CardHeader title="Material received" description={r.notes ?? undefined} />
        <Table>
          <THead>
            <tr>
              <TH>Material</TH>
              <TH numeric>Quantity</TH>
              <TH numeric>Rate</TH>
              <TH numeric>Value</TH>
            </tr>
          </THead>
          <TBody>
            {r.lines.map((l) => (
              <TR key={l.id}>
                <TD className="font-medium">{l.material.name}</TD>
                <TD numeric>{formatNumber(l.quantity)} {l.material.unit}</TD>
                <TD numeric>{formatMoney(l.rate)}</TD>
                <TD numeric>{formatMoney(l.quantity.mul(l.rate).toDecimalPlaces(2))}</TD>
              </TR>
            ))}
            <TR className="bg-slate-50 font-semibold">
              <TD colSpan={3}>Total value received</TD>
              <TD numeric>{formatMoney(total)}</TD>
            </TR>
          </TBody>
        </Table>
        {r.attachment && (
          <div className="border-t border-slate-100 px-5 py-3 text-sm">
            <a href={`/api/attachments/${r.attachment.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-brand-700 hover:underline">
              <Paperclip className="size-4" /> {r.attachment.originalName}
            </a>
          </div>
        )}
      </Card>
    </>
  );
}

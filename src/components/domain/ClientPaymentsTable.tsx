import Link from "next/link";
import { Paperclip } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { formatDate, formatMoney, PAYMENT_METHOD_LABELS } from "@/lib/format";
import { voidClientPayment } from "@/lib/actions/client-payments";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { VoidDialog } from "./VoidDialog";

type Payment = {
  id: string;
  amount: Prisma.Decimal;
  date: Date;
  method: "CASH" | "BANK_TRANSFER";
  reference: string | null;
  description: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
  project: { id: string; name: string };
  attachment: { id: string; originalName: string } | null;
};

/** Client payments list, used on project and client pages. Voided payments are shown struck through. */
export function ClientPaymentsTable({ payments, isAdmin, showProject }: { payments: Payment[]; isAdmin: boolean; showProject?: boolean }) {
  return (
    <Table>
      <THead>
        <tr>
          <TH>Date</TH>
          {showProject && <TH>Project</TH>}
          <TH>Method</TH>
          <TH>Reference</TH>
          <TH>Description</TH>
          <TH numeric>Amount</TH>
          <TH className="w-px"><span className="sr-only">Actions</span></TH>
        </tr>
      </THead>
      <TBody>
        {payments.map((p) => {
          const voided = Boolean(p.voidedAt);
          return (
            <TR key={p.id} className={voided ? "bg-slate-50/60 text-slate-400" : undefined}>
              <TD className={voided ? "text-slate-400" : undefined}>{formatDate(p.date)}</TD>
              {showProject && (
                <TD>
                  <Link href={`/projects/${p.project.id}?tab=payments`} className="text-brand-700 hover:underline">{p.project.name}</Link>
                </TD>
              )}
              <TD className={voided ? "text-slate-400" : undefined}>{PAYMENT_METHOD_LABELS[p.method]}</TD>
              <TD className={voided ? "text-slate-400" : undefined}>{p.reference ?? "—"}</TD>
              <TD className="max-w-xs whitespace-normal">
                <span className={voided ? "text-slate-400" : undefined}>{p.description ?? ""}</span>
                {p.attachment && (
                  <a
                    href={`/api/attachments/${p.attachment.id}`}
                    target="_blank"
                    rel="noopener"
                    className="ml-2 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"
                    title={p.attachment.originalName}
                  >
                    <Paperclip className="size-3.5" /> Receipt
                  </a>
                )}
                {voided && (
                  <div className="mt-1">
                    <Badge tone="red">Voided</Badge> <span className="text-xs text-slate-500">{p.voidReason}</span>
                  </div>
                )}
              </TD>
              <TD numeric className={voided ? "text-slate-400 line-through" : "font-medium text-slate-900"}>{formatMoney(p.amount)}</TD>
              <TD className="whitespace-nowrap">
                {isAdmin && !voided && (
                  <div className="flex justify-end gap-1">
                    <Link
                      href={`/projects/${p.project.id}/payments/${p.id}/edit`}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Edit
                    </Link>
                    <VoidDialog
                      action={voidClientPayment.bind(null, p.id)}
                      title={`Void payment of ${formatMoney(p.amount)}?`}
                      description="The payment stays on record (marked voided, with your reason) but no longer counts in any balance. This cannot be undone — if needed, record it again."
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

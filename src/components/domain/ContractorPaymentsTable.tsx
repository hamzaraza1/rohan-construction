import Link from "next/link";
import { Paperclip } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { formatDate, formatMoney, PAYMENT_METHOD_LABELS } from "@/lib/format";
import { voidContractorPayment } from "@/lib/actions/contracts";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { VoidDialog } from "./VoidDialog";

export const CONTRACTOR_PAYMENT_TYPES = { ADVANCE: "Advance", INSTALLMENT: "Installment", FINAL: "Final payment" } as const;

type Payment = {
  id: string;
  contractId: string;
  type: keyof typeof CONTRACTOR_PAYMENT_TYPES;
  amount: Prisma.Decimal;
  date: Date;
  method: "CASH" | "BANK_TRANSFER";
  reference: string | null;
  description: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
  attachment: { id: string; originalName: string } | null;
  contract?: { id: string; title: string; contractor: { id: string; name: string }; project: { id: string; name: string } };
};

export function ContractorPaymentsTable({ payments, isAdmin, showContract }: { payments: Payment[]; isAdmin: boolean; showContract?: boolean }) {
  return (
    <Table>
      <THead>
        <tr>
          <TH>Date</TH>
          {showContract && <TH>Contract</TH>}
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
              {showContract && p.contract && (
                <TD>
                  <Link href={`/contracts/${p.contract.id}`} className="text-brand-700 hover:underline">{p.contract.title}</Link>
                  <div className="text-xs text-slate-500">{p.contract.project.name}</div>
                </TD>
              )}
              <TD className={dim}>{CONTRACTOR_PAYMENT_TYPES[p.type]}</TD>
              <TD className={dim}>{PAYMENT_METHOD_LABELS[p.method]}</TD>
              <TD className="max-w-xs whitespace-normal">
                <span className={dim}>{[p.reference, p.description].filter(Boolean).join(" · ")}</span>
                {p.attachment && (
                  <a href={`/api/attachments/${p.attachment.id}`} target="_blank" rel="noopener" className="ml-2 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline" title={p.attachment.originalName}>
                    <Paperclip className="size-3.5" /> Receipt
                  </a>
                )}
                {voided && <div className="mt-1"><Badge tone="red">Voided</Badge> <span className="text-xs text-slate-500">{p.voidReason}</span></div>}
              </TD>
              <TD numeric className={voided ? "text-slate-400 line-through" : "font-medium text-slate-900"}>{formatMoney(p.amount)}</TD>
              <TD className="whitespace-nowrap">
                {isAdmin && !voided && (
                  <div className="flex justify-end gap-1">
                    <Link href={`/contracts/${p.contractId}/payments/${p.id}/edit`} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Edit</Link>
                    <VoidDialog
                      action={voidContractorPayment.bind(null, p.id)}
                      title={`Void payment of ${formatMoney(p.amount)}?`}
                      description="The payment stays on record (marked voided, with your reason) but no longer counts in cash, cost or contractor balances."
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

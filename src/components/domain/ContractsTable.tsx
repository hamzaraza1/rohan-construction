import Link from "next/link";
import type { ContractBalanceRow } from "@/lib/queries/contractors";
import { formatMoney } from "@/lib/format";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";

const STATUS = { ACTIVE: ["green", "Active"], COMPLETED: ["slate", "Completed"], TERMINATED: ["amber", "Terminated"] } as const;

export function ContractStatusBadge({ status }: { status: keyof typeof STATUS }) {
  const [tone, label] = STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-slate-100" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${value}%` }} />
      </div>
      <span className="tabular text-xs text-slate-600">{value}%</span>
    </div>
  );
}

type Contract = {
  id: string;
  title: string;
  status: keyof typeof STATUS;
  progressPercent: number;
  voidedAt: Date | null;
  contractor?: { id: string; name: string };
  project?: { id: string; name: string };
};

/** Contracts with commitment vs paid. Used on the project and contractor pages. */
export function ContractsTable({ contracts, balances, show }: { contracts: Contract[]; balances: Map<string, ContractBalanceRow>; show: "contractor" | "project" }) {
  return (
    <Table>
      <THead>
        <tr>
          <TH>Contract</TH>
          <TH>{show === "contractor" ? "Contractor" : "Project"}</TH>
          <TH>Status</TH>
          <TH>Progress</TH>
          <TH numeric>Net payable</TH>
          <TH numeric>Paid</TH>
          <TH numeric>Remaining</TH>
        </tr>
      </THead>
      <TBody>
        {contracts.map((k) => {
          const b = balances.get(k.id);
          const party = show === "contractor" ? k.contractor : k.project;
          return (
            <TR key={k.id} className={k.voidedAt ? "text-slate-400" : undefined}>
              <TD>
                <Link href={`/contracts/${k.id}`} className={k.voidedAt ? "text-slate-400 line-through" : "font-medium text-brand-700 hover:underline"}>
                  {k.title}
                </Link>
                {k.voidedAt && <span className="ml-2"><Badge tone="red">Voided</Badge></span>}
              </TD>
              <TD>
                {party && (
                  <Link href={show === "contractor" ? `/contractors/${party.id}` : `/projects/${party.id}?tab=contracts`} className="hover:underline">
                    {party.name}
                  </Link>
                )}
              </TD>
              <TD>{!k.voidedAt && <ContractStatusBadge status={k.status} />}</TD>
              <TD>{!k.voidedAt && <ProgressBar value={k.progressPercent} />}</TD>
              <TD numeric>{b ? formatMoney(b.netPayable) : "—"}</TD>
              <TD numeric>{b ? formatMoney(b.paid) : "—"}</TD>
              <TD numeric>
                {!b ? "—" : b.overpaid.greaterThan(0) ? (
                  <span className="text-amber-700">{formatMoney(b.overpaid)} overpaid</span>
                ) : (
                  <span className={b.outstanding.isZero() ? "" : "font-medium text-amber-700"}>{formatMoney(b.outstanding)}</span>
                )}
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}

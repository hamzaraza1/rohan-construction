import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Banknote, HandCoins, Landmark, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getMonthlyCashFlow, getProjectSummaries, getRecentTransactions, totals } from "@/lib/queries/dashboard";
import {
  formatDate, formatMoney, LEDGER_SOURCE_LABELS, PAYMENT_METHOD_LABELS, PROJECT_STATUS_LABELS, PROJECT_TYPE_LABELS,
} from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CashFlowChart } from "@/components/charts/CashFlowChart";

export const metadata: Metadata = { title: "Dashboard" };

const statusTone = { ACTIVE: "green", PLANNING: "blue", ON_HOLD: "amber", COMPLETED: "slate", CANCELLED: "red" } as const;

export default async function DashboardPage() {
  const user = await requireUser();
  const [projects, monthly, recent] = await Promise.all([
    getProjectSummaries(),
    getMonthlyCashFlow(),
    getRecentTransactions(10),
  ]);
  const t = totals(projects);
  const activeCount = projects.filter((p) => p.status === "ACTIVE").length;

  return (
    <>
      <PageHeader
        title="Company overview"
        description={`Welcome, ${user.name}. ${projects.length} project${projects.length === 1 ? "" : "s"} tracked, ${activeCount} active.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Client receipts" value={formatMoney(t.clientReceipts)} hint="All money received from clients" icon={<ArrowDownLeft className="size-5" />} />
        <StatCard label="Construction payments" value={formatMoney(t.cashOutflows)} hint="Suppliers + contractors + expenses paid" icon={<ArrowUpRight className="size-5" />} />
        <StatCard label="Partner withdrawals" value={formatMoney(t.partnerWithdrawals)} hint="Drawings — not construction cost" icon={<HandCoins className="size-5" />} />
        <StatCard
          label="Available cash (all sites)"
          value={formatMoney(t.cashBalance)}
          tone={t.cashBalance.isNegative() ? "negative" : "positive"}
          hint="Receipts − payments − withdrawals"
          icon={<Wallet className="size-5" />}
        />
        <StatCard
          label="Owed to suppliers"
          value={formatMoney(t.supplierOutstanding)}
          tone={t.supplierOutstanding.isZero() ? "default" : "warning"}
          hint="Material received but not yet paid"
          icon={<Landmark className="size-5" />}
        />
        <StatCard
          label="Owed to contractors"
          value={formatMoney(t.contractorOutstanding)}
          tone={t.contractorOutstanding.isZero() ? "default" : "warning"}
          hint="Contract value (± adjustments) not yet paid"
          icon={<Banknote className="size-5" />}
        />
      </div>

      <Card className="mt-6">
        <CardHeader title="Monthly cash flow" description="Last 12 months, all projects. Partner withdrawals are not included in construction payments." />
        <div className="p-4">
          <CashFlowChart data={monthly} />
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Projects" description="Cash position and outstanding balances per site" />
        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Projects are created in the Projects module (Phase 2). Once created, each project's figures appear here automatically."
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Project</TH>
                <TH>Type</TH>
                <TH>Status</TH>
                <TH numeric>Received</TH>
                <TH numeric>Paid out</TH>
                <TH numeric>Withdrawals</TH>
                <TH numeric>Cash balance</TH>
                <TH numeric>Owed (suppl. + contr.)</TH>
              </tr>
            </THead>
            <TBody>
              {projects.map((p) => (
                <TR key={p.projectId}>
                  <TD>
                    <Link href={`/projects/${p.projectId}`} className="font-medium text-brand-700 hover:underline">{p.name}</Link>
                    <div className="text-xs text-slate-500">{p.clientName}</div>
                  </TD>
                  <TD>{PROJECT_TYPE_LABELS[p.type]}</TD>
                  <TD>
                    <Badge tone={statusTone[p.status as keyof typeof statusTone] ?? "slate"}>
                      {PROJECT_STATUS_LABELS[p.status as keyof typeof PROJECT_STATUS_LABELS] ?? p.status}
                    </Badge>
                  </TD>
                  <TD numeric>{formatMoney(p.clientReceipts)}</TD>
                  <TD numeric>{formatMoney(p.supplierPayments.plus(p.contractorPayments).plus(p.directExpenses))}</TD>
                  <TD numeric>{formatMoney(p.partnerWithdrawals)}</TD>
                  <TD numeric className={p.cashBalance.isNegative() ? "font-semibold text-red-700" : "font-semibold"}>
                    {formatMoney(p.cashBalance)}
                  </TD>
                  <TD numeric>{formatMoney(p.supplierOutstanding.plus(p.contractorOutstanding))}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="Recent transactions" description="Latest cash movements across all projects" />
        {recent.length === 0 ? (
          <EmptyState title="No transactions recorded yet" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Project</TH>
                <TH>Type</TH>
                <TH>Party</TH>
                <TH>Method</TH>
                <TH numeric>In</TH>
                <TH numeric>Out</TH>
              </tr>
            </THead>
            <TBody>
              {recent.map((r) => (
                <TR key={`${r.sourceType}-${r.sourceId}`}>
                  <TD>{formatDate(r.date)}</TD>
                  <TD>{r.projectName}</TD>
                  <TD>{LEDGER_SOURCE_LABELS[r.sourceType] ?? r.sourceType}</TD>
                  <TD>{r.counterparty ?? "—"}</TD>
                  <TD>{PAYMENT_METHOD_LABELS[r.method as keyof typeof PAYMENT_METHOD_LABELS] ?? r.method}</TD>
                  <TD numeric className="text-emerald-700">{r.inflow.isZero() ? "" : formatMoney(r.inflow)}</TD>
                  <TD numeric className="text-slate-900">{r.outflow.isZero() ? "" : formatMoney(r.outflow)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}

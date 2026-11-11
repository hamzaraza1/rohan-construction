"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowDownLeft, ArrowRight, Banknote, Building2, CheckCircle2, HardHat, HandCoins, Plus, Receipt, Truck, Wallet, Zap } from "lucide-react";
import { useStore } from "@/lib/store";
import { DEMO_TODAY } from "@/lib/mock-data";
import { monthlyCashFlow, projectFinancials, supplierAccounts, contractBalance, sum } from "@/lib/calculations";
import { formatMoney, formatMoneyShort } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { CashFlowChart } from "@/components/charts/Charts";
import { ProjectSummaryTable, useProjectRows } from "@/components/domain/ProjectTable";
import { LedgerTable } from "@/components/domain/LedgerTable";

export default function DashboardPage() {
  const { data, session, canEdit } = useStore();
  const t = useMemo(() => projectFinancials(data), [data]);
  const monthly = useMemo(() => monthlyCashFlow(data, DEMO_TODAY.slice(0, 7), 12), [data]);
  const rows = useProjectRows();
  const active = data.projects.filter((p) => p.status === "ACTIVE").length;
  const completed = data.projects.filter((p) => p.status === "COMPLETED").length;

  const topPayables = useMemo(() => {
    const sup = supplierAccounts(data).filter((a) => a.balance > 0).map((a) => ({
      key: `s-${a.projectId}-${a.supplierId}`, name: data.suppliers.find((s) => s.id === a.supplierId)?.name ?? "", href: `/suppliers/${a.supplierId}`,
      project: data.projects.find((p) => p.id === a.projectId)?.name ?? "", amount: a.balance, kind: "Supplier" as const,
    }));
    const con = data.contracts.map((c) => ({ c, b: contractBalance(data, c) })).filter((x) => x.b.outstanding > 0 && x.c.status === "ACTIVE").map(({ c, b }) => ({
      key: `c-${c.id}`, name: data.contractors.find((k) => k.id === c.contractorId)?.name ?? "", href: `/contractors/contracts/${c.id}`,
      project: data.projects.find((p) => p.id === c.projectId)?.name ?? "", amount: b.outstanding, kind: "Contractor" as const,
    }));
    return [...sup, ...con].sort((a, b) => b.amount - a.amount).slice(0, 6);
  }, [data]);

  const spendMix = [
    { label: "Supplier payments", value: t.supplierPaid, color: "bg-series-1" },
    { label: "Contractor payments", value: t.contractorPaid, color: "bg-series-2" },
    { label: "Site expenses", value: t.siteExpenses, color: "bg-series-3" },
  ];
  const spendTotal = sum(spendMix, (x) => x.value);

  return (
    <>
      <PageHeader
        title="Company overview"
        description={`Assalam-o-Alaikum, ${session.name.split(" ")[0]}. Here is where all sites stand today.`}
        actions={
          canEdit && (
            <>
              <ButtonLink href="/payments?new=1" variant="secondary"><ArrowDownLeft className="size-4" /> Record payment</ButtonLink>
              <ButtonLink href="/expenses?new=1" variant="secondary"><Receipt className="size-4" /> Add expense</ButtonLink>
              <ButtonLink href="/projects/new"><Plus className="size-4" /> New project</ButtonLink>
            </>
          )
        }
      />

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Total projects" value={data.projects.length} icon={<Building2 className="size-5" />} tone="brand" hint={`${data.projects.filter((p) => p.status === "PLANNING").length} planning · ${data.projects.filter((p) => p.status === "ON_HOLD").length} on hold`} />
        <StatCard label="Active" value={active} icon={<Zap className="size-5" />} tone="positive" hint="Work in progress" />
        <StatCard label="Completed" value={completed} icon={<CheckCircle2 className="size-5" />} hint="Handed over" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:gap-4 xl:grid-cols-5">
        <StatCard label="Client payments" value={formatMoneyShort(t.received)} hint={`${formatMoney(t.received)} received`} icon={<ArrowDownLeft className="size-5" />} tone="positive" />
        <StatCard label="Total expenses" value={formatMoneyShort(t.totalExpenses)} hint="Suppliers + contractors + site" icon={<Receipt className="size-5" />} />
        <StatCard label="Available cash" value={formatMoneyShort(t.cash)} hint={`After ${formatMoneyShort(t.withdrawals)} partner withdrawals`} icon={<Wallet className="size-5" />} tone={t.cash < 0 ? "negative" : "brand"} />
        <StatCard label="Owed to contractors" value={formatMoneyShort(t.contractorOutstanding)} hint="Unpaid contract balances" icon={<HardHat className="size-5" />} tone="warning" />
        <StatCard label="Owed to suppliers" value={formatMoneyShort(t.supplierOutstanding)} hint={`${formatMoneyShort(t.supplierAdvance)} advance with suppliers`} icon={<Truck className="size-5" />} tone="warning" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Monthly cash flow" description="Last 12 months, all sites. Partner withdrawals are not included." />
          <div className="px-2 pt-4 pb-2 sm:px-4">
            <CashFlowChart data={monthly} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Where the money went" description="All payments made, by type" />
          <div className="space-y-4 p-5">
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
              {spendMix.map((s) => (
                <div key={s.label} className={`${s.color} border-r-2 border-white last:border-r-0`} style={{ width: `${spendTotal ? (s.value / spendTotal) * 100 : 0}%` }} title={`${s.label}: ${formatMoney(s.value)}`} />
              ))}
            </div>
            <ul className="space-y-3">
              {spendMix.map((s) => (
                <li key={s.label} className="flex items-center gap-3 text-sm">
                  <span className={`size-2.5 rounded-sm ${s.color}`} />
                  <span className="flex-1 text-slate-600">{s.label}</span>
                  <span className="tabular font-medium text-slate-900">{formatMoney(s.value)}</span>
                  <span className="tabular w-10 text-right text-xs text-slate-500">{spendTotal ? Math.round((s.value / spendTotal) * 100) : 0}%</span>
                </li>
              ))}
              <li className="flex items-center gap-3 border-t border-slate-100 pt-3 text-sm">
                <HandCoins className="size-3.5 text-slate-400" />
                <span className="flex-1 text-slate-600">Partner withdrawals <span className="text-xs text-slate-400">(not an expense)</span></span>
                <span className="tabular font-medium text-slate-900">{formatMoney(t.withdrawals)}</span>
                <span className="w-10" />
              </li>
            </ul>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Recent transactions"
            description="Latest cash movements across all projects"
            actions={<ButtonLink href="/reports?tab=ledger" variant="ghost" size="sm">View all <ArrowRight className="size-4" /></ButtonLink>}
          />
          <LedgerTable limit={8} compact />
        </Card>
        <Card>
          <CardHeader title="Biggest payables" description="Who we owe the most right now" />
          {topPayables.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">Nothing owed.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {topPayables.map((x) => (
                <li key={x.key}>
                  <Link href={x.href} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      {x.kind === "Supplier" ? <Truck className="size-4" /> : <Banknote className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{x.name}</span>
                      <span className="block truncate text-xs text-slate-500">{x.kind} · {x.project}</span>
                    </span>
                    <span className="tabular text-sm font-semibold text-amber-700">{formatMoney(x.amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Project summary" description="Cash position and balances per site" actions={<ButtonLink href="/projects" variant="ghost" size="sm">All projects <ArrowRight className="size-4" /></ButtonLink>} />
        <ProjectSummaryTable rows={rows} search={false} />
      </Card>
    </>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ArrowDownLeft, Boxes, CalendarDays, FileSignature, HardHat, MapPin, Pencil, Printer, Receipt, Truck, User, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import { useTab } from "@/lib/use-tab";
import { DEMO_TODAY } from "@/lib/mock-data";
import { cashLedger, monthlyCashFlow, projectFinancials, projectStock, sum } from "@/lib/calculations";
import { formatDate, formatMoney, formatMoneyShort } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, DetailList, StatCard } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ProgressBar, ProjectStatusBadge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { CashFlowChart, CategoryBarChart } from "@/components/charts/Charts";
import { LedgerTable } from "@/components/domain/LedgerTable";
import { QuickAdd } from "@/components/domain/QuickAdd";
import {
  ClientPaymentsTable, ContractorPaymentsTable, ContractsTable, DeliveriesTable, ExpensesTable, MovementsTable, StockTable, SupplierAccountsTable,
  SupplierPaymentsTable, WithdrawalsTable,
} from "@/components/domain/Tables";
import { StockMovementForm } from "@/components/forms/inventory";
import type { StockMovementType } from "@/lib/types";

const TABS = ["overview", "transactions", "payments", "contractors", "suppliers", "inventory", "expenses", "withdrawals"] as const;
type Tab = (typeof TABS)[number];

function Line({ label, value, strong, minus, hint }: { label: string; value: number; strong?: boolean; minus?: boolean; hint?: string }) {
  return (
    <div className={strong ? "flex items-baseline justify-between gap-4 border-t border-slate-200 px-5 py-3" : "flex items-baseline justify-between gap-4 px-5 py-2"}>
      <span className={strong ? "font-semibold text-slate-900" : "text-sm text-slate-600"}>
        {minus && <span className="mr-1 text-slate-400">−</span>}
        {label}
        {hint && <span className="block text-xs font-normal text-slate-400">{hint}</span>}
      </span>
      <span className={`tabular ${strong ? (value < 0 ? "text-lg font-semibold text-red-700" : "text-lg font-semibold text-slate-900") : "text-sm font-medium text-slate-800"}`}>{formatMoney(value)}</span>
    </div>
  );
}

function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { data, canEdit } = useStore();
  const [tab, setTab] = useTab<Tab>("overview", TABS);
  const [stockForm, setStockForm] = useState<{ materialId: string; type: StockMovementType }>();
  const p = data.projects.find((x) => x.id === id);
  const fin = useMemo(() => (p ? projectFinancials(data, p.id) : undefined), [data, p]);
  const monthly = useMemo(() => (p ? monthlyCashFlow(data, DEMO_TODAY.slice(0, 7), 12, p.id) : []), [data, p]);
  const stockValue = useMemo(() => (p ? sum(projectStock(data, p.id), (r) => r.stockValue) : 0), [data, p]);
  const byCategory = useMemo(() => {
    if (!p) return [];
    const m = new Map<string, number>();
    for (const e of data.expenses) if (e.projectId === p.id) m.set(e.categoryId, (m.get(e.categoryId) ?? 0) + e.amount);
    return [...m.entries()].map(([k, v]) => ({ name: data.expenseCategories.find((c) => c.id === k)?.name ?? k, value: v })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [data, p]);

  if (!p || !fin) {
    return (
      <Card>
        <EmptyState title="Project not found" description="It may have been removed." action={<ButtonLink href="/projects" variant="secondary">Back to projects</ButtonLink>} />
      </Card>
    );
  }
  const client = data.clients.find((c) => c.id === p.clientId);
  const counts = {
    transactions: cashLedger(data, p.id).length,
    payments: data.clientPayments.filter((x) => x.projectId === p.id).length,
    contractors: data.contracts.filter((x) => x.projectId === p.id).length,
    suppliers: data.deliveries.filter((x) => x.projectId === p.id).length,
    expenses: data.expenses.filter((x) => x.projectId === p.id).length,
    withdrawals: data.withdrawals.filter((x) => x.projectId === p.id).length,
  };
  const receivedPct = p.contractValue ? Math.round((fin.received / p.contractValue) * 100) : 0;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Projects", href: "/projects" }, { label: p.code }]}
        title={p.name}
        meta={
          <>
            <ProjectStatusBadge status={p.status} />
            <span className="flex items-center gap-1.5"><User className="size-4 text-slate-400" />{client ? <Link href={`/clients/${client.id}`} className="text-brand-700 hover:underline">{client.name}</Link> : "—"}</span>
            <span className="flex items-center gap-1.5"><MapPin className="size-4 text-slate-400" />{p.siteAddress}, {p.city}</span>
            <span className="flex items-center gap-1.5"><CalendarDays className="size-4 text-slate-400" />{formatDate(p.startDate)} → {formatDate(p.expectedEndDate)}</span>
            <span className="flex w-40 items-center gap-2"><ProgressBar value={p.progress} /></span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
            {canEdit && <ButtonLink href={`/projects/${p.id}/edit`} variant="secondary"><Pencil className="size-4" /> Edit</ButtonLink>}
            <QuickAdd projectId={p.id} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <StatCard label="Contract value" value={formatMoneyShort(p.contractValue)} hint={formatMoney(p.contractValue)} icon={<FileSignature className="size-5" />} tone="brand" />
        <StatCard label="Received from client" value={formatMoneyShort(fin.received)} hint={`${receivedPct}% · ${formatMoneyShort(fin.clientBalance)} still due`} icon={<ArrowDownLeft className="size-5" />} tone="positive" />
        <StatCard label="Total expenses" value={formatMoneyShort(fin.totalExpenses)} hint="Suppliers + contractors + site" icon={<Receipt className="size-5" />} />
        <StatCard label="Cash balance" value={formatMoneyShort(fin.cash)} hint={formatMoney(fin.cash)} icon={<Wallet className="size-5" />} tone={fin.cash < 0 ? "negative" : "positive"} />
        <StatCard label="Payables" value={formatMoneyShort(fin.supplierOutstanding + fin.contractorOutstanding)} hint={`Suppliers ${formatMoneyShort(fin.supplierOutstanding)} · Contractors ${formatMoneyShort(fin.contractorOutstanding)}`} icon={<HardHat className="size-5" />} tone="warning" />
      </div>

      <Tabs
        className="mt-6 mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "transactions", label: "Transactions", count: counts.transactions },
          { value: "payments", label: "Client payments", count: counts.payments },
          { value: "contractors", label: "Contractors", count: counts.contractors },
          { value: "suppliers", label: "Suppliers", count: counts.suppliers },
          { value: "inventory", label: "Inventory" },
          { value: "expenses", label: "Expenses", count: counts.expenses },
          { value: "withdrawals", label: "Withdrawals", count: counts.withdrawals },
        ]}
      />

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader title="Cash position" description="How the cash balance is worked out" />
              <div className="py-2">
                <Line label="Received from client" value={fin.received} />
                <Line minus label="Paid to suppliers" value={fin.supplierPaid} />
                <Line minus label="Paid to contractors" value={fin.contractorPaid} />
                <Line minus label="Site expenses" value={fin.siteExpenses} />
                <Line minus label="Partner withdrawals" value={fin.withdrawals} hint="Not an expense" />
                <Line strong label="Cash balance" value={fin.cash} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Contractors" description="Commitments vs payments" />
              <div className="py-2">
                <Line label="Contracts (incl. extras/deductions)" value={fin.contractCommitted} />
                <Line minus label="Paid so far" value={fin.contractorPaid} />
                <Line strong label="Still payable" value={fin.contractorOutstanding} />
              </div>
              <div className="border-t border-slate-100 px-5 py-3">
                <button type="button" onClick={() => setTab("contractors")} className="text-sm font-medium text-brand-700 hover:underline">View contracts →</button>
              </div>
            </Card>
            <Card>
              <CardHeader title="Suppliers & material" description="Received material vs payments" />
              <div className="py-2">
                <Line label="Material received (value)" value={fin.materialReceived} />
                <Line minus label="Paid to suppliers" value={fin.supplierPaid} />
                <Line strong label="Owed to suppliers" value={fin.supplierOutstanding} />
                <Line label="Advance with suppliers" value={fin.supplierAdvance} hint="Paid, material not yet delivered" />
                <Line label="Stock value at site" value={stockValue} />
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Monthly cash flow" description="This project, last 12 months" />
              <div className="px-2 pt-4 pb-2 sm:px-4"><CashFlowChart data={monthly} height={260} /></div>
            </Card>
            <Card>
              <CardHeader title="Project details" />
              <DetailList
                items={[
                  ["Project code", p.code],
                  ["Contract type", "With Material"],
                  ["Plot size", p.plotSize],
                  ["Site engineer", p.siteEngineer],
                  ["Start date", formatDate(p.startDate)],
                  ["Expected completion", formatDate(p.expectedEndDate)],
                  ["Client phone", client?.phone],
                ]}
              />
              {p.description && <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-600">{p.description}</p>}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Site expenses by category" actions={<button type="button" onClick={() => setTab("expenses")} className="text-sm font-medium text-brand-700 hover:underline">All expenses →</button>} />
              <div className="p-4">{byCategory.length ? <CategoryBarChart data={byCategory} name="Spent" /> : <EmptyState title="No expenses yet" />}</div>
            </Card>
            <Card>
              <CardHeader title="Latest transactions" actions={<button type="button" onClick={() => setTab("transactions")} className="text-sm font-medium text-brand-700 hover:underline">All transactions →</button>} />
              <LedgerTable projectId={p.id} limit={7} compact />
            </Card>
          </div>
        </div>
      )}

      {tab === "transactions" && (
        <Card>
          <CardHeader title="Transaction history" description="Every rupee in and out of this project, with running cash balance" />
          <LedgerTable projectId={p.id} />
        </Card>
      )}

      {tab === "payments" && (
        <Card>
          <CardHeader title="Client payments" description={`Contract ${formatMoney(p.contractValue)} · received ${formatMoney(fin.received)} · due ${formatMoney(fin.clientBalance)}`} />
          <ClientPaymentsTable projectId={p.id} />
        </Card>
      )}

      {tab === "contractors" && (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Contracts" description="Work given to contractors on this site" />
            <ContractsTable projectId={p.id} />
          </Card>
          <Card>
            <CardHeader title="Payments to contractors" />
            <ContractorPaymentsTable projectId={p.id} />
          </Card>
        </div>
      )}

      {tab === "suppliers" && (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Supplier balances" description="Per supplier for this project. Advances are not stock until material arrives." />
            <SupplierAccountsTable projectId={p.id} />
          </Card>
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Truck className="size-4 text-slate-400" />Material deliveries</span>} description="Click a delivery to see its items" />
            <DeliveriesTable projectId={p.id} />
          </Card>
          <Card>
            <CardHeader title="Payments to suppliers" />
            <SupplierPaymentsTable projectId={p.id} />
          </Card>
        </div>
      )}

      {tab === "inventory" && (
        <div className="space-y-6">
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Boxes className="size-4 text-slate-400" />Stock at this site</span>} description={`Current stock value ${formatMoney(stockValue)} (at average purchase rate)`} />
            <StockTable projectId={p.id} onAction={(r, type) => setStockForm({ materialId: r.materialId, type })} />
          </Card>
          <Card>
            <CardHeader title="Stock movement history" />
            <MovementsTable projectId={p.id} />
          </Card>
        </div>
      )}

      {tab === "expenses" && (
        <Card>
          <CardHeader title="Site expenses" />
          <ExpensesTable projectId={p.id} />
        </Card>
      )}

      {tab === "withdrawals" && (
        <Card>
          <CardHeader title="Partner withdrawals from this project" description="These reduce cash but are not counted as project expenses" />
          <WithdrawalsTable projectId={p.id} />
        </Card>
      )}

      {stockForm && <StockMovementForm projectId={p.id} materialId={stockForm.materialId} type={stockForm.type} onClose={() => setStockForm(undefined)} />}
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ProjectPage />
    </Suspense>
  );
}

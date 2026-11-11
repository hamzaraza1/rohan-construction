"use client";

import { Suspense, useMemo, useState } from "react";
import { BookOpen, Boxes, Building2, HandCoins, HardHat, Receipt, Truck, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import { useTab } from "@/lib/use-tab";
import { DEMO_TODAY } from "@/lib/mock-data";
import { cashLedger, contractBalance, LEDGER_LABELS, projectFinancials, projectStock, sum, supplierAccounts } from "@/lib/calculations";
import { formatDate, formatMoney, formatQty, PAYMENT_METHOD_LABELS, PROJECT_STATUS_LABELS, CONTRACT_STATUS_LABELS } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { FilterSelect } from "@/components/ui/DataTable";
import { ALL_TIME, DateRangeFilter, inRange, resolveRange, type DateRange } from "@/components/ui/DateRangeFilter";
import { ReportTable, type ReportColumn } from "@/components/domain/ReportTable";
import { cn } from "@/lib/cn";

const REPORTS = [
  { value: "projects", label: "Project-wise", icon: Building2, description: "Financial position of every project" },
  { value: "ledger", label: "Cash book", icon: BookOpen, description: "Every cash movement in and out" },
  { value: "expenses", label: "Expenses", icon: Receipt, description: "Site expenses by category and project" },
  { value: "payments", label: "Client payments", icon: Wallet, description: "Money received from clients" },
  { value: "contractors", label: "Contractors", icon: HardHat, description: "Contracts, payments and balances" },
  { value: "suppliers", label: "Suppliers", icon: Truck, description: "Deliveries, payments, advances, balances" },
  { value: "inventory", label: "Inventory", icon: Boxes, description: "Stock received, used, wasted, in hand" },
  { value: "withdrawals", label: "Partner withdrawals", icon: HandCoins, description: "Withdrawals by partner and project" },
] as const;
type ReportKey = (typeof REPORTS)[number]["value"];
const KEYS = REPORTS.map((r) => r.value) as unknown as readonly ReportKey[];

const money = <T,>(header: string, f: (r: T) => number, rows: T[], opts: { total?: boolean; className?: (r: T) => string } = {}): ReportColumn<T> => {
  const s = sum(rows, f);
  return {
    header,
    align: "right",
    value: (r) => Math.round(f(r) * 100) / 100,
    render: (r) => <span className={opts.className?.(r)}>{formatMoney(f(r))}</span>,
    total: opts.total === false ? undefined : { display: formatMoney(s), raw: Math.round(s * 100) / 100 },
  };
};

function Reports() {
  const { data } = useStore();
  const [report, setReport] = useTab<ReportKey>("projects", KEYS);
  const [projectId, setProjectId] = useState("");
  const [range, setRange] = useState<DateRange>(ALL_TIME);
  const [extra, setExtra] = useState("");
  const pName = (id: string) => data.projects.find((p) => p.id === id)?.name ?? "—";
  const inProject = (id: string) => !projectId || id === projectId;
  const meta = REPORTS.find((r) => r.value === report)!;
  const usesDates = !["projects", "contractors", "suppliers", "inventory"].includes(report);

  const { rows, columns, cards, extraFilter } = useMemo(() => {
    const dated = <T extends { date: string }>(r: T) => inRange(r.date, range);
    switch (report) {
      case "projects": {
        const rows = data.projects.filter((p) => inProject(p.id) && (!extra || p.status === extra)).map((p) => ({ p, f: projectFinancials(data, p.id), stock: sum(projectStock(data, p.id), (s) => s.stockValue) }));
        type R = (typeof rows)[number];
        return {
          rows,
          cards: [["Contract value", sum(rows, (r) => r.p.contractValue)], ["Received", sum(rows, (r) => r.f.received)], ["Total expenses", sum(rows, (r) => r.f.totalExpenses)], ["Cash balance", sum(rows, (r) => r.f.cash)]] as [string, number][],
          extraFilter: (
            <FilterSelect label="Status" value={extra} onChange={setExtra}>
              <option value="">All statuses</option>
              {Object.entries(PROJECT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </FilterSelect>
          ),
          columns: [
            { header: "Project", value: (r: R) => `${r.p.code} ${r.p.name}`, render: (r: R) => <span className="font-medium text-slate-900">{r.p.name}<span className="block text-xs font-normal text-slate-500">{r.p.code} · {PROJECT_STATUS_LABELS[r.p.status]}</span></span> },
            money<R>("Contract value", (r) => r.p.contractValue, rows),
            money<R>("Received", (r) => r.f.received, rows),
            money<R>("Client balance", (r) => r.f.clientBalance, rows),
            money<R>("Supplier payments", (r) => r.f.supplierPaid, rows),
            money<R>("Contractor payments", (r) => r.f.contractorPaid, rows),
            money<R>("Site expenses", (r) => r.f.siteExpenses, rows),
            money<R>("Total expenses", (r) => r.f.totalExpenses, rows),
            money<R>("Withdrawals", (r) => r.f.withdrawals, rows),
            money<R>("Cash balance", (r) => r.f.cash, rows, { className: (r) => (r.f.cash < 0 ? "font-semibold text-red-700" : "font-semibold") }),
            money<R>("Owed to suppliers", (r) => r.f.supplierOutstanding, rows),
            money<R>("Owed to contractors", (r) => r.f.contractorOutstanding, rows),
            money<R>("Stock value", (r) => r.stock, rows),
          ] as ReportColumn<R>[],
        };
      }
      case "ledger": {
        const rows = cashLedger(data).filter((e) => inProject(e.projectId) && dated(e) && (!extra || e.kind === extra)).reverse();
        type R = (typeof rows)[number];
        return {
          rows,
          cards: [["Money in", sum(rows, (r) => r.inflow)], ["Money out", sum(rows, (r) => r.outflow)], ["Net", sum(rows, (r) => r.inflow - r.outflow)]] as [string, number][],
          extraFilter: (
            <FilterSelect label="Type" value={extra} onChange={setExtra}>
              <option value="">All types</option>
              {Object.entries(LEDGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </FilterSelect>
          ),
          columns: [
            { header: "Date", value: (r: R) => r.date, render: (r: R) => formatDate(r.date) },
            { header: "Project", value: (r: R) => pName(r.projectId) },
            { header: "Type", value: (r: R) => LEDGER_LABELS[r.kind] },
            { header: "Party", value: (r: R) => r.party },
            { header: "Details", value: (r: R) => r.description },
            { header: "Method", value: (r: R) => PAYMENT_METHOD_LABELS[r.method as PaymentMethod] },
            money<R>("In", (r) => r.inflow, rows, { className: () => "text-emerald-700" }),
            money<R>("Out", (r) => r.outflow, rows),
          ] as ReportColumn<R>[],
        };
      }
      case "expenses": {
        const rows = data.expenses.filter((e) => inProject(e.projectId) && dated(e) && (!extra || e.categoryId === extra || (extra === "misc" && data.expenseCategories.find((c) => c.id === e.categoryId)?.isMiscellaneous))).sort((a, b) => a.date.localeCompare(b.date));
        type R = (typeof rows)[number];
        const cat = (id: string) => data.expenseCategories.find((c) => c.id === id)?.name ?? "";
        const byCat = new Map<string, number>();
        rows.forEach((r) => byCat.set(cat(r.categoryId), (byCat.get(cat(r.categoryId)) ?? 0) + r.amount));
        const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
        return {
          rows,
          cards: [["Total expenses", sum(rows, (r) => r.amount)], ...top] as [string, number][],
          extraFilter: (
            <FilterSelect label="Category" value={extra} onChange={setExtra} className="max-w-56">
              <option value="">All categories</option>
              <option value="misc">Miscellaneous only</option>
              {data.expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FilterSelect>
          ),
          columns: [
            { header: "Date", value: (r: R) => r.date, render: (r: R) => formatDate(r.date) },
            { header: "Project", value: (r: R) => pName(r.projectId) },
            { header: "Category", value: (r: R) => cat(r.categoryId) },
            { header: "Description", value: (r: R) => r.description },
            { header: "Paid to", value: (r: R) => r.paidTo },
            { header: "Method", value: (r: R) => PAYMENT_METHOD_LABELS[r.method] },
            { header: "Receipt", value: (r: R) => (r.attachment ? "Yes" : "No") },
            money<R>("Amount", (r) => r.amount, rows),
          ] as ReportColumn<R>[],
        };
      }
      case "payments": {
        const rows = data.clientPayments.filter((p) => inProject(p.projectId) && dated(p) && (!extra || p.method === extra)).sort((a, b) => a.date.localeCompare(b.date));
        type R = (typeof rows)[number];
        const client = (pid: string) => data.clients.find((c) => c.id === data.projects.find((p) => p.id === pid)?.clientId)?.name ?? "";
        return {
          rows,
          cards: [["Total received", sum(rows, (r) => r.amount)], ["Bank / cheque", sum(rows.filter((r) => r.method !== "CASH"), (r) => r.amount)], ["Cash", sum(rows.filter((r) => r.method === "CASH"), (r) => r.amount)]] as [string, number][],
          extraFilter: (
            <FilterSelect label="Method" value={extra} onChange={setExtra}>
              <option value="">All methods</option>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </FilterSelect>
          ),
          columns: [
            { header: "Date", value: (r: R) => r.date, render: (r: R) => formatDate(r.date) },
            { header: "Client", value: (r: R) => client(r.projectId) },
            { header: "Project", value: (r: R) => pName(r.projectId) },
            { header: "Method", value: (r: R) => PAYMENT_METHOD_LABELS[r.method] },
            { header: "Bank", value: (r: R) => r.bankName ?? "" },
            { header: "Reference", value: (r: R) => r.reference ?? "" },
            { header: "Note", value: (r: R) => r.note ?? "" },
            money<R>("Amount", (r) => r.amount, rows, { className: () => "text-emerald-700" }),
          ] as ReportColumn<R>[],
        };
      }
      case "contractors": {
        const rows = data.contracts.filter((c) => inProject(c.projectId) && (!extra || c.contractorId === extra)).map((c) => ({ c, b: contractBalance(data, c) }));
        type R = (typeof rows)[number];
        return {
          rows,
          cards: [["Net payable", sum(rows, (r) => r.b.netPayable)], ["Paid", sum(rows, (r) => r.b.paid)], ["Outstanding", sum(rows, (r) => r.b.outstanding)]] as [string, number][],
          extraFilter: (
            <FilterSelect label="Contractor" value={extra} onChange={setExtra}>
              <option value="">All contractors</option>
              {data.contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FilterSelect>
          ),
          columns: [
            { header: "Contractor", value: (r: R) => data.contractors.find((x) => x.id === r.c.contractorId)?.name },
            { header: "Project", value: (r: R) => pName(r.c.projectId) },
            { header: "Work", value: (r: R) => data.workCategories.find((w) => w.id === r.c.workCategoryId)?.name },
            { header: "Status", value: (r: R) => `${CONTRACT_STATUS_LABELS[r.c.status]} (${r.c.progress}%)` },
            money<R>("Agreed", (r) => r.c.amount, rows),
            money<R>("Extras", (r) => r.b.extras, rows),
            money<R>("Deductions", (r) => r.b.deductions, rows),
            money<R>("Net payable", (r) => r.b.netPayable, rows),
            money<R>("Paid", (r) => r.b.paid, rows),
            money<R>("Outstanding", (r) => r.b.outstanding, rows, { className: (r) => (r.b.outstanding > 0 ? "font-semibold text-amber-700" : "") }),
          ] as ReportColumn<R>[],
        };
      }
      case "suppliers": {
        const rows = supplierAccounts(data).filter((a) => inProject(a.projectId) && (!extra || a.supplierId === extra));
        type R = (typeof rows)[number];
        return {
          rows,
          cards: [["Material received", sum(rows, (r) => r.delivered)], ["Paid", sum(rows, (r) => r.paid)], ["Advances", sum(rows, (r) => Math.max(-r.balance, 0))], ["Outstanding", sum(rows, (r) => Math.max(r.balance, 0))]] as [string, number][],
          extraFilter: (
            <FilterSelect label="Supplier" value={extra} onChange={setExtra}>
              <option value="">All suppliers</option>
              {data.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </FilterSelect>
          ),
          columns: [
            { header: "Supplier", value: (r: R) => data.suppliers.find((s) => s.id === r.supplierId)?.name },
            { header: "Project", value: (r: R) => pName(r.projectId) },
            money<R>("Material received", (r) => r.delivered, rows),
            money<R>("Advances paid", (r) => r.advancesPaid, rows),
            money<R>("Total paid", (r) => r.paid, rows),
            money<R>("Advance balance", (r) => Math.max(-r.balance, 0), rows),
            money<R>("Outstanding", (r) => Math.max(r.balance, 0), rows, { className: (r) => (r.balance > 0 ? "font-semibold text-amber-700" : "") }),
          ] as ReportColumn<R>[],
        };
      }
      case "inventory": {
        const rows = projectStock(data).filter((s) => inProject(s.projectId) && (!extra || data.materials.find((m) => m.id === s.materialId)?.categoryId === extra));
        type R = (typeof rows)[number];
        const m = (id: string) => data.materials.find((x) => x.id === id);
        return {
          rows,
          cards: [["Received value", sum(rows, (r) => r.receivedValue)], ["Stock value", sum(rows, (r) => r.stockValue)], ["Wastage value", sum(rows, (r) => r.wasted * r.avgRate)]] as [string, number][],
          extraFilter: (
            <FilterSelect label="Category" value={extra} onChange={setExtra}>
              <option value="">All categories</option>
              {data.materialCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FilterSelect>
          ),
          columns: [
            { header: "Project", value: (r: R) => pName(r.projectId) },
            { header: "Material", value: (r: R) => m(r.materialId)?.name },
            { header: "Unit", value: (r: R) => m(r.materialId)?.unit },
            { header: "Received", align: "right", value: (r: R) => r.received, render: (r: R) => formatQty(r.received) },
            { header: "Consumed", align: "right", value: (r: R) => r.consumed, render: (r: R) => formatQty(r.consumed) },
            { header: "Wastage", align: "right", value: (r: R) => r.wasted, render: (r: R) => formatQty(r.wasted) },
            { header: "In stock", align: "right", value: (r: R) => r.onHand, render: (r: R) => <span className="font-semibold">{formatQty(r.onHand)}</span> },
            money<R>("Avg. rate", (r) => r.avgRate, rows, { total: false }),
            money<R>("Stock value", (r) => r.stockValue, rows),
          ] as ReportColumn<R>[],
        };
      }
      case "withdrawals": {
        const rows = data.withdrawals.filter((w) => inProject(w.projectId) && dated(w) && (!extra || w.partnerId === extra)).sort((a, b) => a.date.localeCompare(b.date));
        type R = (typeof rows)[number];
        return {
          rows,
          cards: [["Total withdrawn", sum(rows, (r) => r.amount)], ...data.partners.map((p) => [p.name, sum(rows.filter((r) => r.partnerId === p.id), (r) => r.amount)])] as [string, number][],
          extraFilter: (
            <FilterSelect label="Partner" value={extra} onChange={setExtra}>
              <option value="">All partners</option>
              {data.partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </FilterSelect>
          ),
          columns: [
            { header: "Date", value: (r: R) => r.date, render: (r: R) => formatDate(r.date) },
            { header: "Partner", value: (r: R) => data.partners.find((p) => p.id === r.partnerId)?.name },
            { header: "Project", value: (r: R) => pName(r.projectId) },
            { header: "Method", value: (r: R) => PAYMENT_METHOD_LABELS[r.method] },
            { header: "Note", value: (r: R) => r.note ?? "" },
            money<R>("Amount", (r) => r.amount, rows),
          ] as ReportColumn<R>[],
        };
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, report, projectId, range, extra]);

  const { from, to } = resolveRange(range);
  const period = usesDates ? (from || to ? `${formatDate(from)} – ${formatDate(to ?? DEMO_TODAY)}` : "All dates") : `As of ${formatDate(DEMO_TODAY)}`;
  const subtitle = `${projectId ? pName(projectId) : "All projects"} · ${period}`;

  return (
    <>
      <PageHeader title="Reports" description="Pick a report, filter it, then export to Excel or print / save as PDF." />
      <div className="no-print mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {REPORTS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => {
              setReport(r.value);
              setExtra("");
            }}
            aria-pressed={report === r.value}
            className={cn("flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition", report === r.value ? "border-brand-600 bg-brand-700 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300")}
          >
            <r.icon className={cn("size-5", report === r.value ? "text-accent-400" : "text-slate-400")} />
            <span className="text-sm leading-tight font-medium">{r.label}</span>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader
          title={`${meta.label} report`}
          description={`${meta.description} · ${subtitle}`}
          actions={
            <div className="no-print flex flex-wrap items-center gap-2">
              <FilterSelect label="Project" value={projectId} onChange={setProjectId} className="max-w-56">
                <option value="">All projects</option>
                {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </FilterSelect>
              {extraFilter}
              {usesDates && <DateRangeFilter value={range} onChange={setRange} />}
            </div>
          }
        />
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(([label, value]) => <StatCard key={label} label={label} value={formatMoney(value)} className="shadow-none" />)}
        </div>
        <ReportTable
          key={report}
          title={`${meta.label} report — ${data.settings.companyName}`}
          subtitle={subtitle}
          filename={`${meta.label.toLowerCase().replace(/\W+/g, "-")}-report-${DEMO_TODAY}`}
          rows={rows as never[]}
          columns={columns as ReportColumn<never>[]}
        />
      </Card>
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Reports />
    </Suspense>
  );
}

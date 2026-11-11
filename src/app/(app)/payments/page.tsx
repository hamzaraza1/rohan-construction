"use client";

import { Suspense, useState } from "react";
import { ArrowDownLeft, Banknote, Building, CalendarDays, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNewParam } from "@/lib/use-tab";
import { DEMO_TODAY } from "@/lib/mock-data";
import { sum } from "@/lib/calculations";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ClientPaymentForm } from "@/components/forms/clients";
import { ClientPaymentsTable } from "@/components/domain/Tables";
import { useProjectRows } from "@/components/domain/ProjectTable";
import Link from "next/link";

function PaymentsPage() {
  const { data, canEdit } = useStore();
  const [open, setOpen] = useState(useNewParam() && canEdit);
  const rows = data.clientPayments;
  const total = sum(rows, (r) => r.amount);
  const month = sum(rows.filter((r) => r.date.startsWith(DEMO_TODAY.slice(0, 7))), (r) => r.amount);
  const cash = sum(rows.filter((r) => r.method === "CASH"), (r) => r.amount);
  const projects = useProjectRows().filter((p) => p.fin.clientBalance > 0 && p.status !== "COMPLETED").sort((a, b) => b.fin.clientBalance - a.fin.clientBalance);

  return (
    <>
      <PageHeader
        title="Client payments"
        description="All money received from clients, by cash, bank transfer or cheque"
        actions={canEdit && <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Record payment</Button>}
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total received" value={formatMoney(total)} hint={`${rows.length} payments`} icon={<ArrowDownLeft className="size-5" />} tone="positive" />
        <StatCard label="This month" value={formatMoney(month)} icon={<CalendarDays className="size-5" />} />
        <StatCard label="By bank / cheque" value={formatMoney(total - cash)} hint={`${total ? Math.round(((total - cash) / total) * 100) : 0}% of receipts`} icon={<Building className="size-5" />} />
        <StatCard label="In cash" value={formatMoney(cash)} icon={<Banknote className="size-5" />} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-4">
        <Card className="xl:col-span-3">
          <CardHeader title="Payment history" />
          <ClientPaymentsTable />
        </Card>
        <Card>
          <CardHeader title="Still to be received" description="Contract value not yet paid" />
          <ul className="divide-y divide-slate-100">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}?tab=payments`} className="block px-5 py-3 hover:bg-slate-50">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-slate-900">{p.name}</span>
                    <span className="tabular text-sm font-semibold text-amber-700">{formatMoney(p.fin.clientBalance)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-series-1" style={{ width: `${Math.min(100, (p.fin.received / p.contractValue) * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{p.clientName} · {Math.round((p.fin.received / p.contractValue) * 100)}% received</p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {open && <ClientPaymentForm onClose={() => setOpen(false)} />}
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <PaymentsPage />
    </Suspense>
  );
}

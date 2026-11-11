"use client";

import { Suspense, useMemo, useState } from "react";
import { CalendarDays, Paperclip, Plus, Receipt, Shapes } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNewParam, useTab } from "@/lib/use-tab";
import { DEMO_TODAY } from "@/lib/mock-data";
import { sum } from "@/lib/calculations";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { CategoryBarChart } from "@/components/charts/Charts";
import { ExpenseForm } from "@/components/forms/finance";
import { ExpensesTable } from "@/components/domain/Tables";

const TABS = ["all", "regular", "misc", "categories"] as const;

function ExpensesPage() {
  const { data, canEdit } = useStore();
  const openNew = useNewParam();
  const [tab, setTab] = useTab<(typeof TABS)[number]>("all", TABS);
  const [form, setForm] = useState<"regular" | "misc" | undefined>(openNew && canEdit ? "regular" : undefined);
  const isMisc = (id: string) => Boolean(data.expenseCategories.find((c) => c.id === id)?.isMiscellaneous);
  const total = sum(data.expenses, (e) => e.amount);
  const month = sum(data.expenses.filter((e) => e.date.startsWith(DEMO_TODAY.slice(0, 7))), (e) => e.amount);
  const misc = sum(data.expenses.filter((e) => isMisc(e.categoryId)), (e) => e.amount);
  const withReceipt = data.expenses.filter((e) => e.attachment).length;

  const byCat = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>();
    for (const e of data.expenses) {
      const x = m.get(e.categoryId) ?? { total: 0, count: 0 };
      x.total += e.amount;
      x.count++;
      m.set(e.categoryId, x);
    }
    return data.expenseCategories.map((c) => ({ ...c, ...(m.get(c.id) ?? { total: 0, count: 0 }) })).sort((a, b) => b.total - a.total);
  }, [data]);

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Site running costs: labour wages, transport, machinery, bills and miscellaneous. Supplier and contractor payments are kept in their own modules."
        actions={
          canEdit && (
            <>
              <Button variant="secondary" onClick={() => setForm("misc")}><Shapes className="size-4" /> Misc. expense</Button>
              <Button onClick={() => setForm("regular")}><Plus className="size-4" /> Add expense</Button>
            </>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total site expenses" value={formatMoney(total)} hint={`${data.expenses.length} entries`} icon={<Receipt className="size-5" />} tone="brand" />
        <StatCard label="This month" value={formatMoney(month)} icon={<CalendarDays className="size-5" />} />
        <StatCard label="Miscellaneous / irregular" value={formatMoney(misc)} hint={`${total ? ((misc / total) * 100).toFixed(1) : 0}% of all expenses`} icon={<Shapes className="size-5" />} tone="warning" />
        <StatCard label="With receipt attached" value={`${withReceipt} of ${data.expenses.length}`} hint="Attach bills for audit" icon={<Paperclip className="size-5" />} />
      </div>

      <Tabs
        className="mt-6 mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "all", label: "All expenses", count: data.expenses.length },
          { value: "regular", label: "Regular" },
          { value: "misc", label: "Miscellaneous", count: data.expenses.filter((e) => isMisc(e.categoryId)).length },
          { value: "categories", label: "By category" },
        ]}
      />

      {tab === "all" && <Card><ExpensesTable /></Card>}
      {tab === "regular" && <Card><CardHeader title="Regular site expenses" /><ExpensesTable misc="exclude" /></Card>}
      {tab === "misc" && (
        <Card>
          <CardHeader title="Miscellaneous / irregular expenses" description="One-off and irregular spending kept separate so it is easy to review" actions={canEdit && <Button size="sm" onClick={() => setForm("misc")}><Plus className="size-4" /> Add misc. expense</Button>} />
          <ExpensesTable misc="only" />
        </Card>
      )}
      {tab === "categories" && (
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader title="Spending by category" description="All projects, all time" />
            <div className="p-4"><CategoryBarChart data={byCat.filter((c) => c.total > 0).map((c) => ({ name: c.name, value: c.total }))} name="Spent" /></div>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="Categories" description="Manage the list in Settings" />
            <ul className="divide-y divide-slate-100">
              {byCat.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="flex-1">
                    <span className="font-medium text-slate-800">{c.name}</span>
                    {c.isMiscellaneous && <span className="ml-2 rounded bg-violet-50 px-1.5 text-[11px] font-medium text-violet-700">Misc</span>}
                    {!c.isActive && <span className="ml-2 text-xs text-slate-400">(inactive)</span>}
                    <span className="block text-xs text-slate-500">{c.count} entries</span>
                  </span>
                  <span className="tabular font-medium text-slate-900">{formatMoney(c.total)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {form && <ExpenseForm miscOnly={form === "misc"} onClose={() => setForm(undefined)} />}
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ExpensesPage />
    </Suspense>
  );
}

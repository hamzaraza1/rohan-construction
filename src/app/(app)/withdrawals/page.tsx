"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { HandCoins, Info, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { useTab } from "@/lib/use-tab";
import { sum } from "@/lib/calculations";
import { formatDate, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable } from "@/components/ui/DataTable";
import { WithdrawalForm } from "@/components/forms/finance";
import { WithdrawalsTable } from "@/components/domain/Tables";
import { cn } from "@/lib/cn";

const TABS = ["all", "partner", "project"] as const;

function WithdrawalsPage() {
  const { data, canEdit } = useStore();
  const [tab, setTab] = useTab<(typeof TABS)[number]>("all", TABS);
  const [form, setForm] = useState<{ partnerId?: string } | null>(null);
  const [partner, setPartner] = useState(data.partners[0]?.id ?? "");
  const total = sum(data.withdrawals, (w) => w.amount);

  const perPartner = useMemo(
    () => data.partners.map((p) => {
      const ws = data.withdrawals.filter((w) => w.partnerId === p.id);
      return { ...p, total: sum(ws, (w) => w.amount), count: ws.length, last: ws.map((w) => w.date).sort().at(-1) };
    }),
    [data],
  );
  const perProject = useMemo(
    () => data.projects.map((p) => {
      const ws = data.withdrawals.filter((w) => w.projectId === p.id);
      const byPartner = Object.fromEntries(data.partners.map((pa) => [pa.id, sum(ws.filter((w) => w.partnerId === pa.id), (w) => w.amount)]));
      return { id: p.id, name: p.name, code: p.code, total: sum(ws, (w) => w.amount), byPartner, count: ws.length };
    }).filter((r) => r.count > 0),
    [data],
  );

  return (
    <>
      <PageHeader
        title="Partner withdrawals"
        description="Money taken out of projects by the partners"
        actions={canEdit && <Button onClick={() => setForm({})}><Plus className="size-4" /> Record withdrawal</Button>}
      />
      <div className="mb-6 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>Withdrawals reduce the project&apos;s available cash, but they are <b>not</b> project expenses and are never added to construction cost.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total withdrawals" value={formatMoney(total)} hint={`${data.withdrawals.length} withdrawals`} icon={<HandCoins className="size-5" />} tone="brand" />
        {perPartner.map((p) => (
          <StatCard key={p.id} label={p.name} value={formatMoney(p.total)} hint={`${p.sharePercent}% share · ${p.count} withdrawals${p.last ? ` · last ${formatDate(p.last)}` : ""}`} />
        ))}
      </div>

      <Tabs className="mt-6 mb-6" value={tab} onChange={setTab} tabs={[{ value: "all", label: "All withdrawals" }, { value: "partner", label: "Partner-wise" }, { value: "project", label: "Project-wise" }]} />

      {tab === "all" && <Card><WithdrawalsTable /></Card>}

      {tab === "partner" && (
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="space-y-2">
            {perPartner.map((p) => (
              <button key={p.id} type="button" onClick={() => setPartner(p.id)} className={cn("w-full rounded-xl border px-4 py-3 text-left transition", partner === p.id ? "border-brand-600 bg-white shadow-sm ring-2 ring-brand-500/20" : "border-slate-200 bg-white hover:border-slate-300")}>
                <span className="block font-medium text-slate-900">{p.name}</span>
                <span className="tabular block text-sm text-slate-600">{formatMoney(p.total)}</span>
                <span className="block text-xs text-slate-500">{p.count} withdrawals · {p.sharePercent}% share</span>
              </button>
            ))}
          </div>
          <Card className="lg:col-span-3">
            <CardHeader title={`${data.partners.find((p) => p.id === partner)?.name ?? ""} — withdrawal history`} actions={canEdit && <Button size="sm" variant="secondary" onClick={() => setForm({ partnerId: partner })}><Plus className="size-4" /> Record</Button>} />
            <WithdrawalsTable key={partner} partnerId={partner} />
          </Card>
        </div>
      )}

      {tab === "project" && (
        <Card>
          <CardHeader title="Withdrawals by project" />
          <DataTable
            rows={perProject}
            rowKey={(r) => r.id}
            initialSort={{ key: "total", dir: "desc" }}
            emptyTitle="No withdrawals yet"
            columns={[
              { key: "name", header: "Project", sortValue: (r) => r.name, render: (r) => <Link href={`/projects/${r.id}?tab=withdrawals`} className="font-medium text-brand-700 hover:underline">{r.name}<span className="block text-xs font-normal text-slate-500">{r.code}</span></Link> },
              ...data.partners.map((pa) => ({ key: pa.id, header: pa.name, align: "right" as const, sortValue: (r: (typeof perProject)[number]) => r.byPartner[pa.id], render: (r: (typeof perProject)[number]) => (r.byPartner[pa.id] ? formatMoney(r.byPartner[pa.id]) : <span className="text-slate-300">—</span>) })),
              { key: "total", header: "Total", align: "right", sortValue: (r) => r.total, render: (r) => <span className="font-semibold">{formatMoney(r.total)}</span> },
            ]}
            footer={(rs) => (
              <tr>
                <td className="px-4 py-3">Total</td>
                {data.partners.map((pa) => <td key={pa.id} className="tabular px-4 py-3 text-right">{formatMoney(sum(rs, (r) => r.byPartner[pa.id]))}</td>)}
                <td className="tabular px-4 py-3 text-right">{formatMoney(sum(rs, (r) => r.total))}</td>
              </tr>
            )}
          />
        </Card>
      )}

      {form && <WithdrawalForm partnerId={form.partnerId} onClose={() => setForm(null)} />}
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <WithdrawalsPage />
    </Suspense>
  );
}

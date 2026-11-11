"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, LayoutGrid, List, MapPin, Plus, User } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatDate, formatMoney, formatMoneyShort } from "@/lib/format";
import type { ProjectStatus } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { FilterSelect } from "@/components/ui/DataTable";
import { ProgressBar, ProjectStatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProjectSummaryTable, useProjectRows, type ProjectRow } from "@/components/domain/ProjectTable";
import { cn } from "@/lib/cn";

function ProjectCard({ p }: { p: ProjectRow }) {
  const paidPct = p.contractValue ? Math.min(100, (p.fin.received / p.contractValue) * 100) : 0;
  return (
    <Link href={`/projects/${p.id}`} className="group flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-brand-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{p.code}</p>
          <h3 className="truncate font-semibold text-slate-900 group-hover:text-brand-700">{p.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500"><MapPin className="size-3 shrink-0" />{p.siteAddress}, {p.city}</p>
        </div>
        <ProjectStatusBadge status={p.status} />
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-slate-600"><User className="size-3.5" />{p.clientName}</span>
          <span className="flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays className="size-3.5" />{formatDate(p.startDate)}</span>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Work progress</span></div>
          <ProgressBar value={p.progress} />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>Received {formatMoneyShort(p.fin.received)} of {formatMoneyShort(p.contractValue)}</span>
            <span className="tabular">{Math.round(paidPct)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-series-1" style={{ width: `${paidPct}%` }} /></div>
        </div>
      </div>
      <div className="mt-auto grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 text-center">
        <div className="p-3"><p className="text-[11px] text-slate-500 uppercase">Spent</p><p className="tabular text-sm font-semibold text-slate-900">{formatMoneyShort(p.fin.totalExpenses)}</p></div>
        <div className="p-3"><p className="text-[11px] text-slate-500 uppercase">Cash</p><p className={cn("tabular text-sm font-semibold", p.fin.cash < 0 ? "text-red-700" : "text-emerald-700")}>{formatMoneyShort(p.fin.cash)}</p></div>
        <div className="p-3"><p className="text-[11px] text-slate-500 uppercase">Payables</p><p className="tabular text-sm font-semibold text-amber-700">{formatMoneyShort(p.fin.supplierOutstanding + p.fin.contractorOutstanding)}</p></div>
      </div>
    </Link>
  );
}

export default function ProjectsPage() {
  const { data, canEdit } = useStore();
  const all = useProjectRows();
  const [status, setStatus] = useState<"ALL" | ProjectStatus>("ALL");
  const [client, setClient] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [q, setQ] = useState("");
  const count = (s: ProjectStatus) => all.filter((p) => p.status === s).length;
  const rows = all.filter((p) => (status === "ALL" || p.status === status) && (!client || p.clientId === client));
  const cardRows = rows.filter((p) => !q || `${p.name} ${p.code} ${p.clientName} ${p.siteAddress}`.toLowerCase().includes(q.toLowerCase()));

  const filters = (
    <FilterSelect label="Client" value={client} onChange={setClient}>
      <option value="">All clients</option>
      {data.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </FilterSelect>
  );

  return (
    <>
      <PageHeader
        title="Projects"
        description={`${all.length} projects · total contract value ${formatMoney(all.reduce((t, p) => t + p.contractValue, 0))}`}
        actions={canEdit && <ButtonLink href="/projects/new"><Plus className="size-4" /> New project</ButtonLink>}
      />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Tabs
          value={status}
          onChange={setStatus}
          tabs={[
            { value: "ALL", label: "All", count: all.length },
            { value: "ACTIVE", label: "Active", count: count("ACTIVE") },
            { value: "PLANNING", label: "Planning", count: count("PLANNING") },
            { value: "ON_HOLD", label: "On hold", count: count("ON_HOLD") },
            { value: "COMPLETED", label: "Completed", count: count("COMPLETED") },
          ]}
        />
        <div className="flex rounded-lg border border-slate-300 bg-white p-0.5" role="group" aria-label="View">
          <button type="button" onClick={() => setView("cards")} aria-pressed={view === "cards"} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm", view === "cards" ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500")}><LayoutGrid className="size-4" /> Cards</button>
          <button type="button" onClick={() => setView("table")} aria-pressed={view === "table"} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm", view === "table" ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500")}><List className="size-4" /> Table</button>
        </div>
      </div>

      {view === "table" ? (
        <Card><ProjectSummaryTable rows={rows} toolbar={filters} /></Card>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search project, code, client, site…" aria-label="Search projects" className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm sm:w-72" />
            {filters}
          </div>
          {cardRows.length === 0 ? (
            <Card><EmptyState title="No projects match" description="Try another status, client or search." /></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{cardRows.map((p) => <ProjectCard key={p.id} p={p} />)}</div>
          )}
        </>
      )}
    </>
  );
}

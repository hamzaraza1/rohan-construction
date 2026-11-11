"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { projectFinancials } from "@/lib/calculations";
import { formatMoney } from "@/lib/format";
import type { Project } from "@/lib/types";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ProgressBar, ProjectStatusBadge } from "@/components/ui/Badge";

export function useProjectRows(projects?: Project[]) {
  const { data } = useStore();
  return useMemo(
    () =>
      (projects ?? data.projects).map((p) => ({
        ...p,
        clientName: data.clients.find((c) => c.id === p.clientId)?.name ?? "—",
        fin: projectFinancials(data, p.id),
      })),
    [data, projects],
  );
}
export type ProjectRow = ReturnType<typeof useProjectRows>[number];

export const projectColumns: Column<ProjectRow>[] = [
  {
    key: "name",
    header: "Project",
    sortValue: (r) => r.name,
    render: (r) => (
      <div className="min-w-48">
        <Link href={`/projects/${r.id}`} className="font-medium text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>{r.name}</Link>
        <div className="text-xs text-slate-500">{r.code} · {r.clientName}</div>
      </div>
    ),
  },
  { key: "status", header: "Status", sortValue: (r) => r.status, render: (r) => <ProjectStatusBadge status={r.status} /> },
  { key: "progress", header: "Progress", sortValue: (r) => r.progress, render: (r) => <ProgressBar value={r.progress} className="w-32" /> },
  { key: "value", header: "Contract value", align: "right", sortValue: (r) => r.contractValue, render: (r) => formatMoney(r.contractValue) },
  { key: "received", header: "Received", align: "right", sortValue: (r) => r.fin.received, render: (r) => formatMoney(r.fin.received) },
  { key: "spent", header: "Expenses", align: "right", sortValue: (r) => r.fin.totalExpenses, render: (r) => formatMoney(r.fin.totalExpenses) },
  {
    key: "cash",
    header: "Cash balance",
    align: "right",
    sortValue: (r) => r.fin.cash,
    render: (r) => <span className={r.fin.cash < 0 ? "font-semibold text-red-700" : "font-semibold text-slate-900"}>{formatMoney(r.fin.cash)}</span>,
  },
  {
    key: "owed",
    header: "Payables",
    align: "right",
    sortValue: (r) => r.fin.supplierOutstanding + r.fin.contractorOutstanding,
    render: (r) => {
      const v = r.fin.supplierOutstanding + r.fin.contractorOutstanding;
      return <span className={v > 0 ? "text-amber-700" : "text-slate-400"}>{formatMoney(v)}</span>;
    },
  },
];

export function ProjectSummaryTable({ rows, pageSize = 10, search = true, toolbar }: { rows: ProjectRow[]; pageSize?: number; search?: boolean; toolbar?: React.ReactNode }) {
  return (
    <DataTable
      rows={rows}
      columns={projectColumns}
      rowKey={(r) => r.id}
      searchText={search ? (r) => `${r.name} ${r.code} ${r.clientName} ${r.siteAddress} ${r.city}` : undefined}
      searchPlaceholder="Search project, code, client, site…"
      toolbar={toolbar}
      pageSize={pageSize}
      initialSort={{ key: "name", dir: "asc" }}
      footer={(rs) => (
        <tr>
          <td className="px-4 py-3" colSpan={3}>Total ({rs.length} projects)</td>
          <td className="tabular px-4 py-3 text-right">{formatMoney(rs.reduce((t, r) => t + r.contractValue, 0))}</td>
          <td className="tabular px-4 py-3 text-right">{formatMoney(rs.reduce((t, r) => t + r.fin.received, 0))}</td>
          <td className="tabular px-4 py-3 text-right">{formatMoney(rs.reduce((t, r) => t + r.fin.totalExpenses, 0))}</td>
          <td className="tabular px-4 py-3 text-right">{formatMoney(rs.reduce((t, r) => t + r.fin.cash, 0))}</td>
          <td className="tabular px-4 py-3 text-right">{formatMoney(rs.reduce((t, r) => t + r.fin.supplierOutstanding + r.fin.contractorOutstanding, 0))}</td>
        </tr>
      )}
    />
  );
}

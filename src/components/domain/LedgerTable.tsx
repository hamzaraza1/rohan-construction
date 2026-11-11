"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { cashLedger, LEDGER_LABELS, type LedgerEntry, type LedgerKind } from "@/lib/calculations";
import { formatDate, formatMoney, PAYMENT_METHOD_LABELS } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";
import { DataTable, FilterSelect, type Column } from "@/components/ui/DataTable";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ALL_TIME, DateRangeFilter, inRange, type DateRange } from "@/components/ui/DateRangeFilter";

const kindTone: Record<LedgerKind, BadgeTone> = {
  CLIENT_PAYMENT: "green",
  SUPPLIER_PAYMENT: "blue",
  CONTRACTOR_PAYMENT: "violet",
  EXPENSE: "amber",
  WITHDRAWAL: "slate",
};

export function KindBadge({ kind }: { kind: LedgerKind }) {
  return <Badge tone={kindTone[kind]}>{LEDGER_LABELS[kind]}</Badge>;
}

/** Cash movements with filters. When `projectId` is set it also shows a running balance. */
export function LedgerTable({ projectId, limit, compact }: { projectId?: string; limit?: number; compact?: boolean }) {
  const { data } = useStore();
  const [kind, setKind] = useState("");
  const [range, setRange] = useState<DateRange>(ALL_TIME);

  const rows = useMemo(() => {
    const all = cashLedger(data, projectId);
    if (projectId) {
      // running balance, oldest → newest
      let bal = 0;
      const withBal = [...all].reverse().map((e) => ({ ...e, balance: (bal += e.inflow - e.outflow) }));
      return withBal.reverse();
    }
    return all.map((e) => ({ ...e, balance: undefined as number | undefined }));
  }, [data, projectId]);

  const filtered = useMemo(
    () => (limit ? rows.slice(0, limit) : rows.filter((r) => (!kind || r.kind === kind) && inRange(r.date, range))),
    [rows, kind, range, limit],
  );

  const columns: Column<LedgerEntry & { balance?: number }>[] = [
    { key: "date", header: "Date", sortValue: (r) => r.date, render: (r) => <span className="whitespace-nowrap">{formatDate(r.date)}</span> },
    ...(!projectId && !compact
      ? [{ key: "project", header: "Project", sortValue: (r: LedgerEntry) => data.projects.find((p) => p.id === r.projectId)?.name ?? "", render: (r: LedgerEntry) => <Link href={`/projects/${r.projectId}`} className="whitespace-nowrap text-brand-700 hover:underline">{data.projects.find((p) => p.id === r.projectId)?.name}</Link> }]
      : []),
    { key: "kind", header: "Type", sortValue: (r) => r.kind, render: (r) => <KindBadge kind={r.kind} /> },
    {
      key: "party",
      header: "Party / details",
      sortValue: (r) => r.party,
      render: (r) => (
        <div className="max-w-sm min-w-48">
          {r.href ? <Link href={r.href} className="font-medium text-slate-900 hover:underline">{r.party}</Link> : <span className="font-medium text-slate-900">{r.party}</span>}
          <div className="truncate text-xs text-slate-500" title={r.description}>{compact && !projectId ? `${data.projects.find((p) => p.id === r.projectId)?.name} · ` : ""}{r.description}</div>
        </div>
      ),
    },
    ...(!compact ? [{ key: "method", header: "Method", render: (r: LedgerEntry) => PAYMENT_METHOD_LABELS[r.method as PaymentMethod] ?? r.method }] : []),
    ...(compact
      ? [{ key: "amt", header: "Amount", align: "right" as const, render: (r: LedgerEntry) => (r.inflow ? <span className="font-medium text-emerald-700">+ {formatMoney(r.inflow)}</span> : <span className="font-medium">− {formatMoney(r.outflow)}</span>) }]
      : [
          { key: "in", header: "In", align: "right" as const, sortValue: (r: LedgerEntry) => r.inflow, render: (r: LedgerEntry) => (r.inflow ? <span className="font-medium text-emerald-700">{formatMoney(r.inflow)}</span> : "") },
          { key: "out", header: "Out", align: "right" as const, sortValue: (r: LedgerEntry) => r.outflow, render: (r: LedgerEntry) => (r.outflow ? formatMoney(r.outflow) : "") },
        ]),
    ...(projectId && !limit
      ? [{ key: "bal", header: "Balance", align: "right" as const, render: (r: LedgerEntry & { balance?: number }) => <span className={(r.balance ?? 0) < 0 ? "font-medium text-red-700" : "font-medium"}>{formatMoney(r.balance ?? 0)}</span> }]
      : []),
  ];

  return (
    <DataTable
      rows={filtered}
      columns={columns}
      rowKey={(r) => `${r.kind}-${r.id}`}
      searchText={limit ? undefined : (r) => `${r.party} ${r.description} ${LEDGER_LABELS[r.kind]}`}
      searchPlaceholder="Search party or description…"
      pageSize={limit ?? 25}
      initialSort={{ key: "date", dir: "desc" }}
      dense={compact}
      hidePagination={Boolean(limit)}
      toolbar={
        limit ? undefined : (
          <>
            <FilterSelect label="Transaction type" value={kind} onChange={setKind}>
              <option value="">All types</option>
              {(Object.keys(LEDGER_LABELS) as LedgerKind[]).map((k) => <option key={k} value={k}>{LEDGER_LABELS[k]}</option>)}
            </FilterSelect>
            <DateRangeFilter value={range} onChange={setRange} />
          </>
        )
      }
      footer={
        limit
          ? undefined
          : (rs) => (
              <tr>
                <td className="px-4 py-3" colSpan={columns.length - (projectId ? 3 : 2)}>Total of {rs.length} transactions</td>
                <td className="tabular px-4 py-3 text-right text-emerald-700">{formatMoney(rs.reduce((t, r) => t + r.inflow, 0))}</td>
                <td className="tabular px-4 py-3 text-right">{formatMoney(rs.reduce((t, r) => t + r.outflow, 0))}</td>
                {projectId && <td />}
              </tr>
            )
      }
    />
  );
}

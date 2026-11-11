"use client";

import type { ReactNode } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import { downloadCsv } from "@/lib/export";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export interface ReportColumn<T> {
  header: string;
  /** Value for the screen. Defaults to `exportValue`. */
  render?: (row: T) => ReactNode;
  /** Plain value for Excel export. Numbers are exported without formatting. */
  value: (row: T) => string | number | undefined;
  align?: "left" | "right";
  /** Total shown in the footer (already formatted for screen) and its raw value for export. */
  total?: { display: ReactNode; raw: string | number };
}

/** Full, unpaginated report table with Excel (CSV) export and print-to-PDF. */
export function ReportTable<T>({ title, filename, rows, columns, rowKey, subtitle }: { title: string; filename: string; rows: T[]; columns: ReportColumn<T>[]; rowKey?: (r: T) => string; subtitle?: string }) {
  const toast = useToast();
  const hasTotals = columns.some((c) => c.total);
  return (
    <div>
      <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <p className="text-sm text-slate-500"><span className="tabular font-medium text-slate-900">{rows.length}</span> rows</p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!rows.length}
            onClick={() => {
              downloadCsv(filename, columns.map((c) => ({ header: c.header, value: c.value })), rows, hasTotals ? columns.map((c, i) => (c.total ? c.total.raw : i === 0 ? "Total" : "")) : undefined);
              toast("Excel file downloaded");
            }}
          >
            <FileSpreadsheet className="size-4 text-emerald-600" /> Export Excel
          </Button>
          <Button variant="secondary" size="sm" disabled={!rows.length} onClick={() => window.print()}>
            <Printer className="size-4" /> Print / PDF
          </Button>
        </div>
      </div>
      <div className="hidden px-1 pb-3 print:block">
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No data for these filters" description="Change the project or date range." />
      ) : (
        <div className="relative max-h-[70vh] overflow-auto print:max-h-none print:overflow-visible">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                {columns.map((c) => (
                  <th key={c.header} className={cn("px-4 py-2.5 whitespace-nowrap", c.align === "right" && "text-right")}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={rowKey ? rowKey(r) : i} className="hover:bg-slate-50/80">
                  {columns.map((c, ci) => (
                    <td key={c.header} className={cn("px-4 py-2 text-slate-700", ci === 0 && "min-w-48", c.align === "right" && "tabular text-right whitespace-nowrap")}>{c.render ? c.render(r) : c.value(r)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            {hasTotals && (
              <tfoot className="sticky bottom-0 border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
                <tr>
                  {columns.map((c, i) => (
                    <td key={c.header} className={cn("px-4 py-2.5", c.align === "right" && "tabular text-right whitespace-nowrap")}>{c.total ? c.total.display : i === 0 ? "Total" : ""}</td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

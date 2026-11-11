"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Enables sorting on this column. */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Text used by the search box. Omit to hide the search box. */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  /** Extra filter controls shown next to the search box. */
  toolbar?: ReactNode;
  pageSize?: number;
  initialSort?: { key: string; dir: "asc" | "desc" };
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Rendered as a <tfoot> row; receives the filtered (not paginated) rows. */
  footer?: (rows: T[]) => ReactNode;
  rowClassName?: (row: T) => string | undefined;
  dense?: boolean;
  /** Hide the "Showing x of y" / page controls (for short widget lists). */
  hidePagination?: boolean;
}

const PAGE_SIZES = [10, 25, 50, 100];

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchText,
  searchPlaceholder = "Search…",
  toolbar,
  pageSize: initialPageSize = 10,
  initialSort,
  onRowClick,
  emptyTitle = "No records found",
  emptyDescription,
  footer,
  rowClassName,
  dense,
  hidePagination,
}: Props<T>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = q && searchText ? rows.filter((r) => searchText(r).toLowerCase().includes(q)) : rows;
    const col = sort && columns.find((c) => c.key === sort.key);
    if (col?.sortValue) {
      const dir = sort!.dir === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => {
        const x = col.sortValue!(a);
        const y = col.sortValue!(b);
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
      });
    }
    return out;
  }, [rows, query, searchText, sort, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);

  const toggleSort = (key: string) => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
    setPage(1);
  };

  const pad = dense ? "px-3 py-2" : "px-4 py-3";

  return (
    <div className="min-w-0">
      {(searchText || toolbar) && (
        <div className="no-print flex flex-col gap-2 border-b border-slate-100 p-3 sm:flex-row sm:flex-wrap sm:items-center">
          {searchText && (
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder}
                aria-label="Search"
                className="h-9 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
              />
            </div>
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState title={emptyTitle} description={query ? `Nothing matches “${query}”. Try another search or clear the filters.` : emptyDescription} />
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                {columns.map((c) => {
                  const active = sort?.key === c.key;
                  const align = c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left";
                  return (
                    <th key={c.key} scope="col" className={cn(pad, "font-semibold whitespace-nowrap", align, c.headerClassName)} aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}>
                      {c.sortValue ? (
                        <button type="button" onClick={() => toggleSort(c.key)} className={cn("inline-flex items-center gap-1 uppercase hover:text-slate-900", c.align === "right" && "flex-row-reverse", active && "text-slate-900")}>
                          {c.header}
                          {active ? (sort!.dir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />) : <ArrowUpDown className="size-3.5 opacity-40" />}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => (
                <tr
                  key={rowKey(r)}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={cn("align-top transition-colors hover:bg-slate-50/80", onRowClick && "cursor-pointer", rowClassName?.(r))}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn(pad, "text-slate-700", c.align === "right" && "tabular text-right whitespace-nowrap", c.align === "center" && "text-center", c.className)}>
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {footer && <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900 [&_td]:whitespace-nowrap">{footer(filtered)}</tfoot>}
          </table>
        </div>
      )}

      {filtered.length > 0 && !hidePagination && (
        <div className="no-print flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span>
              Showing <span className="tabular font-medium text-slate-900">{(current - 1) * pageSize + 1}–{Math.min(current * pageSize, filtered.length)}</span> of{" "}
              <span className="tabular font-medium text-slate-900">{filtered.length}</span>
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Rows per page"
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm"
            >
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
            </select>
          </div>
          {pages > 1 && (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPage(current - 1)} disabled={current === 1} aria-label="Previous page" className="inline-flex size-8 items-center justify-center rounded-md border border-slate-300 bg-white disabled:opacity-40">
                <ChevronLeft className="size-4" />
              </button>
              <span className="tabular px-2">Page {current} of {pages}</span>
              <button type="button" onClick={() => setPage(current + 1)} disabled={current === pages} aria-label="Next page" className="inline-flex size-8 items-center justify-center rounded-md border border-slate-300 bg-white disabled:opacity-40">
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Small select used in table toolbars. */
export function FilterSelect({ value, onChange, children, label, className }: { value: string; onChange: (v: string) => void; children: ReactNode; label: string; className?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={cn("h-9 max-w-full rounded-lg border border-slate-300 bg-white px-2.5 pr-8 text-sm text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none", className)}
    >
      {children}
    </select>
  );
}

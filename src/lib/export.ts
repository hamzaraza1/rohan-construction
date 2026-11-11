// Stage 1 exports run in the browser. Excel opens the CSV directly.
// Stage 2 can add server-generated .xlsx and PDF files.

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | undefined;
}

function cell(v: string | number | undefined) {
  if (v === undefined || v === null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv<T>(filename: string, columns: ExportColumn<T>[], rows: T[], totals?: (string | number | undefined)[]) {
  const lines = [columns.map((c) => cell(c.header)).join(","), ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(","))];
  if (totals) lines.push(totals.map(cell).join(","));
  // BOM so Excel reads UTF-8 (Rs., dashes) correctly.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

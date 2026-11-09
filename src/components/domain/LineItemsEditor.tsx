"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formatMoney, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/Button";

export type MaterialOption = { id: string; name: string; unit: string; category: { name: string } };
export type LineValue = {
  key: string;
  materialId: string;
  quantity: string;
  rate: string;
  /** Receipt lines created from a purchase order keep their order line and material. */
  poLineId?: string;
  remainingQty?: string;
  orderedQty?: string;
};

const num = (v: string) => {
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
let counter = 0;
const newKey = () => `l${Date.now()}-${++counter}`;

/**
 * Editable material lines (material, quantity, rate). Submits repeated
 * materialId / quantity / rate / poLineId fields, read on the server in order.
 */
export function LineItemsEditor({
  materials,
  initial,
  allowAdd = true,
  quantityLabel = "Quantity",
}: {
  materials: MaterialOption[];
  initial: Omit<LineValue, "key">[];
  allowAdd?: boolean;
  quantityLabel?: string;
}) {
  const [lines, setLines] = useState<LineValue[]>(() =>
    (initial.length ? initial : [{ materialId: "", quantity: "", rate: "" }]).map((l) => ({ ...l, key: newKey() })),
  );
  const update = (key: string, patch: Partial<LineValue>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const unitOf = (id: string) => materials.find((m) => m.id === id)?.unit ?? "";
  const total = lines.reduce((a, l) => a + Math.round(num(l.quantity) * num(l.rate) * 100) / 100, 0);

  const groups = new Map<string, MaterialOption[]>();
  for (const m of materials) groups.set(m.category.name, [...(groups.get(m.category.name) ?? []), m]);

  return (
    <div className="sm:col-span-2">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-3 py-2">Material</th>
              <th className="w-36 px-3 py-2">{quantityLabel}</th>
              <th className="w-36 px-3 py-2">Rate (Rs.)</th>
              <th className="w-36 px-3 py-2 text-right">Amount</th>
              <th className="w-10 px-2 py-2"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l, i) => {
              const fixed = Boolean(l.poLineId);
              const mat = materials.find((m) => m.id === l.materialId);
              return (
                <tr key={l.key}>
                  <td className="px-3 py-2">
                    <input type="hidden" name="poLineId" value={l.poLineId ?? ""} />
                    {fixed ? (
                      <>
                        <input type="hidden" name="materialId" value={l.materialId} />
                        <div className="font-medium text-slate-800">{mat?.name ?? "Material"}</div>
                        <div className="text-xs text-slate-500">
                          Ordered {formatNumber(l.orderedQty ?? 0)} {unitOf(l.materialId)} · remaining {formatNumber(l.remainingQty ?? 0)}
                        </div>
                      </>
                    ) : (
                      <select
                        name="materialId"
                        value={l.materialId}
                        onChange={(e) => update(l.key, { materialId: e.target.value })}
                        aria-label={`Line ${i + 1} material`}
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5"
                      >
                        <option value="">Select material…</option>
                        {[...groups.entries()].map(([cat, ms]) => (
                          <optgroup key={cat} label={cat}>
                            {ms.map((m) => (
                              <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <input
                        name="quantity"
                        inputMode="decimal"
                        value={l.quantity}
                        onChange={(e) => update(l.key, { quantity: e.target.value })}
                        aria-label={`Line ${i + 1} quantity`}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5"
                      />
                      <span className="w-10 shrink-0 text-xs text-slate-500">{unitOf(l.materialId)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      name="rate"
                      inputMode="decimal"
                      value={l.rate}
                      onChange={(e) => update(l.key, { rate: e.target.value })}
                      aria-label={`Line ${i + 1} rate`}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5"
                    />
                  </td>
                  <td className="tabular px-3 py-2 text-right text-slate-700">{formatMoney(Math.round(num(l.quantity) * num(l.rate) * 100) / 100)}</td>
                  <td className="px-2 py-2">
                    {!fixed && lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove line ${i + 1}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50">
            <tr>
              <td colSpan={3} className="px-3 py-2 text-right font-medium text-slate-700">Total</td>
              <td className="tabular px-3 py-2 text-right font-semibold text-slate-900">{formatMoney(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {allowAdd && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => setLines((ls) => [...ls, { key: newKey(), materialId: "", quantity: "", rate: "" }])}
        >
          <Plus className="size-4" /> Add line
        </Button>
      )}
    </div>
  );
}

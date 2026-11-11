"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { projectStock, sum } from "@/lib/calculations";
import { formatMoney, formatQty } from "@/lib/format";
import type { Material } from "@/lib/types";
import { DataTable, FilterSelect } from "@/components/ui/DataTable";
import { MaterialForm } from "@/components/forms/inventory";
import { RowActions } from "./RowActions";

export function MaterialsTable() {
  const { data, remove } = useStore();
  const [edit, setEdit] = useState<Material>();
  const [cat, setCat] = useState("");
  const stock = useMemo(() => projectStock(data), [data]);
  const rows = data.materials
    .filter((m) => !cat || m.categoryId === cat)
    .map((m) => {
      const s = stock.filter((r) => r.materialId === m.id);
      return { ...m, onHand: sum(s, (r) => r.onHand), value: sum(s, (r) => r.stockValue), sites: s.filter((r) => r.onHand > 0).length, used: s.length > 0 };
    });
  return (
    <>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        searchText={(r) => r.name}
        searchPlaceholder="Search material…"
        initialSort={{ key: "name", dir: "asc" }}
        pageSize={25}
        toolbar={
          <FilterSelect label="Category" value={cat} onChange={setCat}>
            <option value="">All categories</option>
            {data.materialCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </FilterSelect>
        }
        columns={[
          { key: "name", header: "Material", sortValue: (r) => r.name, render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
          { key: "cat", header: "Category", sortValue: (r) => data.materialCategories.find((c) => c.id === r.categoryId)?.name ?? "", render: (r) => data.materialCategories.find((c) => c.id === r.categoryId)?.name },
          { key: "unit", header: "Unit", render: (r) => r.unit },
          { key: "sites", header: "Sites with stock", align: "center", sortValue: (r) => r.sites, render: (r) => r.sites },
          { key: "onhand", header: "Total in stock", align: "right", sortValue: (r) => r.onHand, render: (r) => formatQty(r.onHand, r.unit) },
          { key: "value", header: "Stock value", align: "right", sortValue: (r) => r.value, render: (r) => formatMoney(r.value) },
          { key: "actions", header: <span className="sr-only">Actions</span>, render: (r) => <RowActions onEdit={() => setEdit(r)} onDelete={() => remove("materials", r.id)} disabledReason={r.used ? "This material has stock records and cannot be deleted." : undefined} deleteTitle={`Delete ${r.name}?`} /> },
        ]}
      />
      {edit && <MaterialForm material={edit} onClose={() => setEdit(undefined)} />}
    </>
  );
}

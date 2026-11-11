"use client";

import { useStore } from "@/lib/store";
import { checkDate, checkQuantity, clean, parseAmount, required, today, useForm } from "@/lib/form";
import { projectStock } from "@/lib/calculations";
import { formatQty } from "@/lib/format";
import type { Material, StockMovementType } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { FormField, Input, Segmented, Select } from "@/components/ui/Field";
import { FormModal, Grid, InfoBox, ProjectSelect } from "./common";

export function StockMovementForm({ onClose, projectId, materialId, type = "CONSUMPTION" }: { onClose: () => void; projectId?: string; materialId?: string; type?: StockMovementType }) {
  const { data, add } = useStore();
  const toast = useToast();
  const f = useForm(
    { projectId: projectId ?? "", materialId: materialId ?? "", type, date: today(), quantity: "", usedFor: "", note: "" },
    (v) => {
      const onHand = projectStock(data, v.projectId).find((r) => r.materialId === v.materialId)?.onHand ?? 0;
      const mat = data.materials.find((m) => m.id === v.materialId);
      return clean({
        projectId: required(v.projectId, "Project"),
        materialId: required(v.materialId, "Material"),
        date: checkDate(v.date),
        quantity: checkQuantity(v.quantity, onHand, mat?.unit),
        note: v.type === "WASTAGE" ? required(v.note, "Reason for wastage") : undefined,
      });
    },
  );
  const stock = f.values.projectId ? projectStock(data, f.values.projectId).filter((r) => r.onHand > 0) : [];
  const row = stock.find((r) => r.materialId === f.values.materialId);
  const mat = data.materials.find((m) => m.id === f.values.materialId);

  const submit = f.handleSubmit((v) => {
    const quantity = parseAmount(v.quantity);
    add("stockMovements", { projectId: v.projectId, materialId: v.materialId, type: v.type, date: v.date, quantity, usedFor: v.usedFor.trim() || undefined, note: v.note.trim() || undefined });
    toast(`${v.type === "WASTAGE" ? "Wastage" : "Consumption"} of ${formatQty(quantity, mat?.unit)} recorded`);
    onClose();
  });

  return (
    <FormModal title={f.values.type === "WASTAGE" ? "Record wastage" : "Record material consumption"} description="Reduces stock at the site. It is not a new cost: material was costed when it was received." onClose={onClose} onSubmit={submit} submitLabel="Save">
      <Segmented name="mvtype" value={f.values.type} onChange={(t) => f.set("type", t)} options={[{ value: "CONSUMPTION", label: "Used in work" }, { value: "WASTAGE", label: "Wastage / damaged" }]} />
      <Grid>
        <FormField label="Project / site" htmlFor="projectId" required error={f.errors.projectId}>
          <ProjectSelect {...f.bind("projectId")} disabled={Boolean(projectId)} />
        </FormField>
        <FormField label="Material" htmlFor="materialId" required error={f.errors.materialId}>
          <Select {...f.bind("materialId")} disabled={!f.values.projectId}>
            <option value="">{f.values.projectId ? (stock.length ? "Select material…" : "No stock at this site") : "Select project first"}</option>
            {stock.map((r) => {
              const m = data.materials.find((x) => x.id === r.materialId);
              return <option key={r.materialId} value={r.materialId}>{m?.name} — {formatQty(r.onHand, m?.unit)} in stock</option>;
            })}
          </Select>
        </FormField>
      </Grid>
      {row && mat && <InfoBox tone="blue">In stock at this site: <b>{formatQty(row.onHand, mat.unit)}</b></InfoBox>}
      <Grid>
        <FormField label={`Quantity${mat ? ` (${mat.unit})` : ""}`} htmlFor="quantity" required error={f.errors.quantity}>
          <Input {...f.bind("quantity")} inputMode="decimal" />
        </FormField>
        <FormField label="Date" htmlFor="date" required error={f.errors.date}>
          <Input {...f.bind("date")} type="date" max={today()} />
        </FormField>
      </Grid>
      {f.values.type === "CONSUMPTION" ? (
        <FormField label="Used for" htmlFor="usedFor">
          <Input {...f.bind("usedFor")} placeholder="e.g. First floor slab" />
        </FormField>
      ) : null}
      <FormField label={f.values.type === "WASTAGE" ? "Reason" : "Note"} htmlFor="note" required={f.values.type === "WASTAGE"} error={f.errors.note}>
        <Input {...f.bind("note")} placeholder={f.values.type === "WASTAGE" ? "e.g. Bags set due to rain" : ""} />
      </FormField>
    </FormModal>
  );
}

export function MaterialForm({ onClose, material }: { onClose: () => void; material?: Material }) {
  const { data, add, update } = useStore();
  const toast = useToast();
  const f = useForm(
    { name: material?.name ?? "", categoryId: material?.categoryId ?? "", unit: material?.unit ?? "" },
    (v) => clean({
      name: required(v.name, "Material name") ?? (data.materials.some((m) => m.name.toLowerCase() === v.name.trim().toLowerCase() && m.id !== material?.id) ? "A material with this name exists" : undefined),
      categoryId: required(v.categoryId, "Category"),
      unit: required(v.unit, "Unit"),
    }),
  );
  const submit = f.handleSubmit((v) => {
    const row = { name: v.name.trim(), categoryId: v.categoryId, unit: v.unit.trim() };
    if (material) update("materials", material.id, row);
    else add("materials", row);
    toast(material ? "Material updated" : `Material “${row.name}” added`);
    onClose();
  });
  return (
    <FormModal title={material ? "Edit material" : "Add material"} onClose={onClose} onSubmit={submit} size="sm" submitLabel={material ? "Save" : "Add material"}>
      <FormField label="Material name" htmlFor="name" required error={f.errors.name}>
        <Input {...f.bind("name")} placeholder="e.g. Cement (SRC)" />
      </FormField>
      <FormField label="Category" htmlFor="categoryId" required error={f.errors.categoryId}>
        <Select {...f.bind("categoryId")}>
          <option value="">Select…</option>
          {data.materialCategories.filter((c) => c.isActive || c.id === f.values.categoryId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </FormField>
      <FormField label="Unit" htmlFor="unit" required error={f.errors.unit} hint="e.g. bag, kg, ton, cft, pcs, sq ft">
        <Input {...f.bind("unit")} list="units" disabled={Boolean(material)} />
        <datalist id="units">{["bag", "kg", "ton", "cft", "pcs", "sq ft", "ft", "coil", "gallon", "sheet", "set", "litre"].map((u) => <option key={u} value={u} />)}</datalist>
      </FormField>
    </FormModal>
  );
}

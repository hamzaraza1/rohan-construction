"use client";

import { Suspense, useMemo, useState } from "react";
import { AlertTriangle, Boxes, Layers, PackageMinus, PackagePlus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useTab } from "@/lib/use-tab";
import { projectStock, sum } from "@/lib/calculations";
import { formatMoney } from "@/lib/format";
import type { StockMovementType } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { DeliveryForm } from "@/components/forms/suppliers";
import { MaterialForm, StockMovementForm } from "@/components/forms/inventory";
import { DeliveriesTable, MovementsTable, StockTable } from "@/components/domain/Tables";
import { MaterialsTable } from "@/components/domain/MaterialsTable";
import { cn } from "@/lib/cn";

const TABS = ["stock", "receiving", "movements", "materials"] as const;

function InventoryPage() {
  const { data, canEdit } = useStore();
  const [tab, setTab] = useTab<(typeof TABS)[number]>("stock", TABS);
  const sites = data.projects.filter((p) => p.status !== "PLANNING");
  const [projectId, setProjectId] = useState(() => sites.find((p) => p.status === "ACTIVE")?.id ?? "");
  const [form, setForm] = useState<{ kind: "delivery" } | { kind: "movement"; type: StockMovementType; materialId?: string } | { kind: "material" }>();

  const stock = useMemo(() => projectStock(data, projectId || undefined), [data, projectId]);
  const value = sum(stock, (r) => r.stockValue);
  const low = stock.filter((r) => r.onHand > 0 && r.received > 0 && r.onHand / r.received < 0.1).length;
  const wasted = sum(stock, (r) => r.wasted * r.avgRate);
  const pid = projectId || undefined;

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock is kept per site. Material comes in from supplier deliveries and goes out when used or wasted."
        actions={
          canEdit && (
            <>
              <Button variant="secondary" onClick={() => setForm({ kind: "movement", type: "WASTAGE" })}><Trash2 className="size-4" /> Wastage</Button>
              <Button variant="secondary" onClick={() => setForm({ kind: "movement", type: "CONSUMPTION" })}><PackageMinus className="size-4" /> Record consumption</Button>
              <Button onClick={() => setForm({ kind: "delivery" })}><PackagePlus className="size-4" /> Receive material</Button>
            </>
          )
        }
      />

      <div className="mb-5 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-2" role="radiogroup" aria-label="Site">
          {[{ id: "", name: "All sites", code: "" }, ...sites].map((p) => (
            <button
              key={p.id || "all"}
              type="button"
              role="radio"
              aria-checked={projectId === p.id}
              onClick={() => setProjectId(p.id)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                projectId === p.id ? "border-brand-600 bg-brand-700 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
              )}
            >
              <span className="block font-medium">{p.name}</span>
              {p.code && <span className={cn("block text-xs", projectId === p.id ? "text-brand-100" : "text-slate-500")}>{p.code}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Stock value" value={formatMoney(value)} hint="At average purchase rate" icon={<Boxes className="size-5" />} tone="brand" />
        <StatCard label="Materials in stock" value={stock.filter((r) => r.onHand > 0).length} hint={`of ${new Set(stock.map((r) => r.materialId)).size} received`} icon={<Layers className="size-5" />} />
        <StatCard label="Running low" value={low} hint="Less than 10% of received left" icon={<AlertTriangle className="size-5" />} tone={low ? "warning" : "default"} />
        <StatCard label="Wastage value" value={formatMoney(wasted)} hint="Material lost or damaged" icon={<Trash2 className="size-5" />} tone={wasted ? "negative" : "default"} />
      </div>

      <Tabs
        className="mt-6 mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "stock", label: "Current stock" },
          { value: "receiving", label: "Material receiving" },
          { value: "movements", label: "Movement history" },
          { value: "materials", label: "Material list", count: data.materials.length },
        ]}
      />

      {tab === "stock" && (
        <Card>
          <CardHeader title={projectId ? `Stock at ${sites.find((p) => p.id === projectId)?.name}` : "Stock at all sites"} description="Use / Wastage reduces stock. It does not add cost: material was costed when received." />
          <StockTable key={projectId} projectId={pid} onAction={(r, type) => setForm({ kind: "movement", type, materialId: r.materialId })} />
        </Card>
      )}
      {tab === "receiving" && (
        <Card>
          <CardHeader title="Material received" description="Deliveries from suppliers. Click a row to see items." actions={canEdit && <Button size="sm" onClick={() => setForm({ kind: "delivery" })}><PackagePlus className="size-4" /> Receive material</Button>} />
          <DeliveriesTable key={projectId} projectId={pid} />
        </Card>
      )}
      {tab === "movements" && (
        <Card>
          <CardHeader title="Stock movement history" description="Received, consumed and wasted material" />
          <MovementsTable key={projectId} projectId={pid} />
        </Card>
      )}
      {tab === "materials" && (
        <Card>
          <CardHeader title="Material list" description="Materials available to choose when receiving stock" actions={canEdit && <Button size="sm" variant="secondary" onClick={() => setForm({ kind: "material" })}>Add material</Button>} />
          <MaterialsTable />
        </Card>
      )}

      {form?.kind === "delivery" && <DeliveryForm projectId={pid} onClose={() => setForm(undefined)} />}
      {form?.kind === "movement" && <StockMovementForm projectId={pid} materialId={form.materialId} type={form.type} onClose={() => setForm(undefined)} />}
      {form?.kind === "material" && <MaterialForm onClose={() => setForm(undefined)} />}
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <InventoryPage />
    </Suspense>
  );
}

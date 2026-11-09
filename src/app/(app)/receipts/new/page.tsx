import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guards";
import { getProject } from "@/lib/queries/projects";
import { getPurchaseOrder, supplierOptions } from "@/lib/queries/suppliers";
import { materialOptions } from "@/lib/queries/inventory";
import { createReceipt } from "@/lib/actions/purchasing";
import { todayPk } from "@/lib/validation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ReceiptForm } from "@/components/domain/PurchaseForms";

export const metadata: Metadata = { title: "Receive material" };

export default async function NewReceiptPage({ searchParams }: { searchParams: Promise<{ projectId?: string; supplierId?: string; poId?: string }> }) {
  await requireAdminPage();
  const { projectId, supplierId, poId } = await searchParams;
  if (!projectId) notFound();
  const [project, suppliers, materials, po] = await Promise.all([
    getProject(projectId),
    supplierOptions(),
    materialOptions(),
    poId ? getPurchaseOrder(poId) : Promise.resolve(null),
  ]);
  if (!project || (poId && (!po || po.projectId !== projectId))) notFound();
  // Materials on the order stay selectable even if later deactivated.
  if (po) for (const l of po.lines) if (!materials.some((m) => m.id === l.materialId)) materials.push({ id: l.material.id, name: l.material.name, unit: l.material.unit, category: { name: "On this order" } });
  const self = `/receipts/new?projectId=${projectId}`;
  return (
    <>
      <PageHeader
        title="Receive material"
        description={`${project.name}. Receiving adds the material to this site's stock and counts its value as project cost. It does not move cash.`}
      />
      <Card className="max-w-5xl p-6">
        {project.archivedAt || (po && po.status !== "OPEN") ? (
          <p className="text-sm text-slate-600">{project.archivedAt ? "This project is archived." : "This purchase order is not open."}</p>
        ) : (
          <ReceiptForm
            action={createReceipt.bind(null, projectId)}
            suppliers={suppliers.some((s) => s.id === po?.supplierId) || !po ? suppliers : [...suppliers, { id: po.supplier.id, name: po.supplier.name }]}
            materials={materials}
            maxDate={todayPk()}
            fromOrder={po ? { orderNumber: po.orderNumber } : undefined}
            newSupplierHref={po ? undefined : `/suppliers/new?returnTo=${encodeURIComponent(self)}`}
            cancelHref={po ? `/purchase-orders/${po.id}` : `/projects/${projectId}?tab=suppliers`}
            initial={{
              supplierId: po?.supplierId ?? supplierId ?? "",
              purchaseOrderId: po?.id ?? "",
              receiptDate: todayPk(),
              lines: po
                ? po.lines.map((l) => ({
                    materialId: l.materialId,
                    poLineId: l.id,
                    quantity: l.remainingQty.greaterThan(0) ? l.remainingQty.toString() : "",
                    rate: l.rate.toString(),
                    remainingQty: l.remainingQty.toString(),
                    orderedQty: l.quantity.toString(),
                  }))
                : [],
            }}
          />
        )}
      </Card>
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guards";
import { getProject } from "@/lib/queries/projects";
import { supplierOptions } from "@/lib/queries/suppliers";
import { materialOptions } from "@/lib/queries/inventory";
import { createPurchaseOrder } from "@/lib/actions/purchasing";
import { todayPk } from "@/lib/validation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { PurchaseOrderForm } from "@/components/domain/PurchaseForms";

export const metadata: Metadata = { title: "New purchase order" };

export default async function NewPoPage({ searchParams }: { searchParams: Promise<{ projectId?: string; supplierId?: string }> }) {
  await requireAdminPage();
  const { projectId, supplierId } = await searchParams;
  if (!projectId) notFound();
  const [project, suppliers, materials] = await Promise.all([getProject(projectId), supplierOptions(), materialOptions()]);
  if (!project) notFound();
  const self = `/purchase-orders/new?projectId=${projectId}`;
  return (
    <>
      <PageHeader title="New purchase order" description={project.name} />
      <Card className="max-w-5xl p-6">
        {project.archivedAt ? (
          <p className="text-sm text-slate-600">This project is archived.</p>
        ) : (
          <PurchaseOrderForm
            action={createPurchaseOrder.bind(null, projectId)}
            suppliers={suppliers}
            materials={materials}
            newSupplierHref={`/suppliers/new?returnTo=${encodeURIComponent(self)}`}
            cancelHref={`/projects/${projectId}?tab=suppliers`}
            submitLabel="Create purchase order"
            initial={{ supplierId: supplierId ?? "", orderDate: todayPk(), expectedDate: "", notes: "", lines: [] }}
          />
        )}
      </Card>
    </>
  );
}

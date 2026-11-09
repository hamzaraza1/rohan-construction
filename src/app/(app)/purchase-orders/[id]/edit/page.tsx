import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guards";
import { getPurchaseOrder, supplierOptions } from "@/lib/queries/suppliers";
import { materialOptions } from "@/lib/queries/inventory";
import { updatePurchaseOrder } from "@/lib/actions/purchasing";
import { toDateInput } from "@/lib/validation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { PurchaseOrderForm } from "@/components/domain/PurchaseForms";

export const metadata: Metadata = { title: "Edit purchase order" };

export default async function EditPoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const [po, suppliers, materials] = await Promise.all([getPurchaseOrder(id), supplierOptions(), materialOptions()]);
  if (!po) notFound();
  if (po.status !== "OPEN" || po.receipts.length > 0) redirect(`/purchase-orders/${id}`);
  return (
    <>
      <PageHeader title={`Edit PO-${po.orderNumber}`} description={po.project.name} />
      <Card className="max-w-5xl p-6">
        <PurchaseOrderForm
          action={updatePurchaseOrder.bind(null, id)}
          suppliers={suppliers}
          materials={materials}
          cancelHref={`/purchase-orders/${id}`}
          submitLabel="Save changes"
          initial={{
            supplierId: po.supplierId,
            orderDate: toDateInput(po.orderDate),
            expectedDate: toDateInput(po.expectedDate),
            notes: po.notes ?? "",
            lines: po.lines.map((l) => ({ materialId: l.materialId, quantity: l.quantity.toString(), rate: l.rate.toString() })),
          }}
        />
      </Card>
    </>
  );
}

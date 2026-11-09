import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guards";
import { dbRead } from "@/lib/db";
import { updateSupplierPayment } from "@/lib/actions/purchasing";
import { toDateInput, todayPk } from "@/lib/validation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { PaymentForm } from "@/components/domain/PaymentForm";
import { SupplierPaymentFields } from "@/components/domain/PurchaseForms";

export const metadata: Metadata = { title: "Edit supplier payment" };

export default async function EditSupplierPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const p = await dbRead.supplierPayment.findUnique({
    where: { id },
    include: { supplier: true, project: true, attachment: { select: { id: true, originalName: true } } },
  });
  if (!p || p.voidedAt) notFound();
  const orders = await dbRead.purchaseOrder.findMany({
    where: { projectId: p.projectId, supplierId: p.supplierId, status: { not: "CANCELLED" } },
    orderBy: { orderNumber: "desc" },
    select: { id: true, orderNumber: true },
  });
  return (
    <>
      <PageHeader title="Edit supplier payment" description={`${p.supplier.name} · ${p.project.name}`} />
      <Card className="max-w-3xl p-6">
        <PaymentForm
          action={updateSupplierPayment.bind(null, id)}
          maxDate={todayPk()}
          cancelHref={`/projects/${p.projectId}?tab=suppliers`}
          submitLabel="Save changes"
          initial={{
            amount: p.amount.toString(),
            date: toDateInput(p.date),
            method: p.method,
            reference: p.reference ?? "",
            description: p.description ?? "",
            attachment: p.attachment,
          }}
          leading={<SupplierPaymentFields defaultType={p.type} orders={orders} defaultOrderId={p.purchaseOrderId ?? undefined} />}
        />
      </Card>
    </>
  );
}

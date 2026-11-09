import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guards";
import { dbRead } from "@/lib/db";
import { getProject } from "@/lib/queries/projects";
import { getSupplierAccount, supplierOptions } from "@/lib/queries/suppliers";
import { createSupplierPayment } from "@/lib/actions/purchasing";
import { formatMoney } from "@/lib/format";
import { todayPk } from "@/lib/validation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { PaymentForm } from "@/components/domain/PaymentForm";
import { SupplierPaymentFields } from "@/components/domain/PurchaseForms";

export const metadata: Metadata = { title: "Pay supplier" };

export default async function NewSupplierPaymentPage({ searchParams }: { searchParams: Promise<{ projectId?: string; supplierId?: string; poId?: string }> }) {
  await requireAdminPage();
  const { projectId, supplierId, poId } = await searchParams;
  if (!projectId) notFound();
  const project = await getProject(projectId);
  if (!project) notFound();

  // Step 1: choose the supplier.
  if (!supplierId) {
    const suppliers = await supplierOptions();
    return (
      <>
        <PageHeader title="Pay supplier" description={project.name} />
        <Card className="max-w-xl p-6">
          <form className="flex items-end gap-2">
            <input type="hidden" name="projectId" value={projectId} />
            <label className="flex-1 text-sm font-medium text-slate-700">
              Supplier
              <Select name="supplierId" required className="mt-1">
                <option value="">Select a supplier…</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </label>
            <Button type="submit">Continue</Button>
          </form>
          <p className="mt-4 text-sm text-slate-500">
            Supplier not listed? <ButtonLink href={`/suppliers/new?returnTo=${encodeURIComponent(`/supplier-payments/new?projectId=${projectId}`)}`} variant="ghost" size="sm">Add a supplier</ButtonLink>
          </p>
        </Card>
      </>
    );
  }

  const [supplier, account, orders] = await Promise.all([
    dbRead.supplier.findUnique({ where: { id: supplierId } }),
    getSupplierAccount(projectId, supplierId),
    dbRead.purchaseOrder.findMany({
      where: { projectId, supplierId, status: { not: "CANCELLED" } },
      orderBy: { orderNumber: "desc" },
      select: { id: true, orderNumber: true },
    }),
  ]);
  if (!supplier) notFound();
  const payable = account?.outstandingPayable;
  return (
    <>
      <PageHeader
        title={`Pay ${supplier.name}`}
        description={`${project.name} · Received ${formatMoney(account?.receivedValue)} · Paid ${formatMoney(account?.paid)} · ${
          payable?.greaterThan(0) ? `Payable ${formatMoney(payable)}` : `Advance balance ${formatMoney(account?.advanceBalance)}`
        }`}
      />
      <Card className="max-w-3xl p-6">
        <PaymentForm
          action={createSupplierPayment.bind(null, projectId, supplierId)}
          maxDate={todayPk()}
          cancelHref={poId ? `/purchase-orders/${poId}` : `/projects/${projectId}?tab=suppliers`}
          submitLabel="Save payment"
          initial={{ amount: payable?.greaterThan(0) ? payable.toString() : "", date: todayPk(), method: "BANK_TRANSFER", reference: "", description: "" }}
          leading={<SupplierPaymentFields defaultType={payable?.greaterThan(0) ? "PAYMENT" : "ADVANCE"} orders={orders} defaultOrderId={poId} />}
        />
        <p className="mt-4 text-xs text-slate-500">
          Payments reduce the project&apos;s cash. They are not added to project cost — material cost is counted when it is received, so nothing is counted twice.
        </p>
      </Card>
    </>
  );
}

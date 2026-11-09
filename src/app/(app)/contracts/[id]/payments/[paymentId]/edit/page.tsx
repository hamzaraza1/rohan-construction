import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guards";
import { dbRead } from "@/lib/db";
import { updateContractorPayment } from "@/lib/actions/contracts";
import { toDateInput, todayPk } from "@/lib/validation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { PaymentForm } from "@/components/domain/PaymentForm";
import { OverpayField, PaymentTypeField } from "@/components/domain/ContractorPaymentExtras";

export const metadata: Metadata = { title: "Edit contractor payment" };

export default async function EditContractorPaymentPage({ params }: { params: Promise<{ id: string; paymentId: string }> }) {
  await requireAdminPage();
  const { id, paymentId } = await params;
  const p = await dbRead.contractorPayment.findUnique({
    where: { id: paymentId },
    include: { contract: { include: { contractor: true, project: true } }, attachment: { select: { id: true, originalName: true } } },
  });
  if (!p || p.contractId !== id || p.voidedAt) notFound();
  return (
    <>
      <PageHeader title="Edit contractor payment" description={`${p.contract.contractor.name} · ${p.contract.title} · ${p.contract.project.name}`} />
      <Card className="max-w-3xl p-6">
        <PaymentForm
          action={updateContractorPayment.bind(null, paymentId)}
          maxDate={todayPk()}
          cancelHref={`/contracts/${id}`}
          submitLabel="Save changes"
          initial={{
            amount: p.amount.toString(),
            date: toDateInput(p.date),
            method: p.method,
            reference: p.reference ?? "",
            description: p.description ?? "",
            attachment: p.attachment,
          }}
          leading={<PaymentTypeField defaultValue={p.type} />}
          trailing={<OverpayField />}
        />
      </Card>
    </>
  );
}

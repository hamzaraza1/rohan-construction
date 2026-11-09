import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guards";
import { dbRead } from "@/lib/db";
import { updateClientPayment } from "@/lib/actions/client-payments";
import { toDateInput, todayPk } from "@/lib/validation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { PaymentForm } from "@/components/domain/PaymentForm";

export const metadata: Metadata = { title: "Edit client payment" };

export default async function EditPaymentPage({ params }: { params: Promise<{ id: string; paymentId: string }> }) {
  await requireAdminPage();
  const { id, paymentId } = await params;
  const payment = await dbRead.clientPayment.findUnique({
    where: { id: paymentId },
    include: { project: { include: { client: true } }, attachment: { select: { id: true, originalName: true } } },
  });
  if (!payment || payment.projectId !== id || payment.voidedAt) notFound();
  return (
    <>
      <PageHeader
        title="Edit client payment"
        description={`${payment.project.name} · ${payment.project.client.name}. To move a payment to another project, void it and record it on the correct project.`}
      />
      <Card className="max-w-3xl p-6">
        <PaymentForm
          action={updateClientPayment.bind(null, paymentId)}
          maxDate={todayPk()}
          cancelHref={`/projects/${id}?tab=payments`}
          submitLabel="Save changes"
          initial={{
            amount: payment.amount.toString(),
            date: toDateInput(payment.date),
            method: payment.method,
            reference: payment.reference ?? "",
            description: payment.description ?? "",
            attachment: payment.attachment,
          }}
        />
      </Card>
    </>
  );
}

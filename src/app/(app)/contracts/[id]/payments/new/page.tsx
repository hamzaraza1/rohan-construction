import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guards";
import { getContract } from "@/lib/queries/contractors";
import { createContractorPayment } from "@/lib/actions/contracts";
import { formatMoney } from "@/lib/format";
import { todayPk } from "@/lib/validation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { PaymentForm } from "@/components/domain/PaymentForm";
import { OverpayField, PaymentTypeField } from "@/components/domain/ContractorPaymentExtras";

export const metadata: Metadata = { title: "Pay contractor" };

export default async function NewContractorPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const k = await getContract(id);
  if (!k || k.voidedAt) notFound();
  const paidSoFar = k.payments.filter((p) => !p.voidedAt).length;
  const remaining = k.balance ? k.balance.outstanding : null;
  return (
    <>
      <PageHeader
        title={`Pay ${k.contractor.name}`}
        description={`${k.title} · ${k.project.name}${remaining ? ` · Remaining: ${formatMoney(remaining)}` : ""}`}
      />
      <Card className="max-w-3xl p-6">
        {k.project.archivedAt ? (
          <p className="text-sm text-slate-600">The project is archived. Restore it before recording payments.</p>
        ) : (
          <PaymentForm
            action={createContractorPayment.bind(null, id)}
            maxDate={todayPk()}
            cancelHref={`/contracts/${id}`}
            submitLabel="Save payment"
            initial={{ amount: "", date: todayPk(), method: "CASH", reference: "", description: "" }}
            leading={<PaymentTypeField defaultValue={paidSoFar === 0 ? "ADVANCE" : "INSTALLMENT"} />}
            trailing={<OverpayField />}
          />
        )}
      </Card>
    </>
  );
}

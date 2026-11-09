import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guards";
import { getProject } from "@/lib/queries/projects";
import { createClientPayment } from "@/lib/actions/client-payments";
import { todayPk } from "@/lib/validation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { PaymentForm } from "@/components/domain/PaymentForm";

export const metadata: Metadata = { title: "Record client payment" };

export default async function NewPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  return (
    <>
      <PageHeader title="Record client payment" description={`${project.name} · received from ${project.client.name}`} />
      <Card className="max-w-3xl p-6">
        {project.archivedAt ? (
          <p className="text-sm text-slate-600">This project is archived. Restore it before recording payments.</p>
        ) : (
          <PaymentForm
            action={createClientPayment.bind(null, id)}
            maxDate={todayPk()}
            cancelHref={`/projects/${id}?tab=payments`}
            submitLabel="Save payment"
            initial={{ amount: "", date: todayPk(), method: "BANK_TRANSFER", reference: "", description: "" }}
          />
        )}
      </Card>
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guards";
import { getContract, contractorOptions, workCategoryOptions } from "@/lib/queries/contractors";
import { updateContract } from "@/lib/actions/contracts";
import { toDateInput } from "@/lib/validation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ContractForm } from "@/components/domain/ContractForm";

export const metadata: Metadata = { title: "Edit contract" };

export default async function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const [k, contractors, workCategories] = await Promise.all([getContract(id), contractorOptions(), workCategoryOptions()]);
  if (!k || k.voidedAt) notFound();
  if (!contractors.some((c) => c.id === k.contractorId)) {
    contractors.unshift({ id: k.contractor.id, name: k.contractor.name, specialization: k.contractor.specialization });
  }
  const hasPayments = k.payments.some((p) => !p.voidedAt);
  return (
    <>
      <PageHeader title={`Edit ${k.title}`} description={`${k.project.name}. Changes are recorded in the audit log.`} />
      <Card className="max-w-5xl p-6">
        <ContractForm
          action={updateContract.bind(null, id)}
          contractors={contractors}
          workCategories={workCategories}
          contractorLocked={hasPayments}
          cancelHref={`/contracts/${id}`}
          submitLabel="Save changes"
          initial={{
            contractorId: k.contractorId,
            title: k.title,
            description: k.description ?? "",
            contractAmount: k.contractAmount.toString(),
            startDate: toDateInput(k.startDate),
            endDate: toDateInput(k.endDate),
            status: k.status,
            progressPercent: String(k.progressPercent),
            scope: Object.fromEntries(k.scopeItems.map((s) => [s.workCategoryId, s.included ? "included" : "excluded"])),
          }}
        />
      </Card>
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guards";
import { dbRead } from "@/lib/db";
import { updateContractor } from "@/lib/actions/contractors";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ContractorForm } from "@/components/domain/ContractorForm";

export const metadata: Metadata = { title: "Edit contractor" };

export default async function EditContractorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const c = await dbRead.contractor.findUnique({ where: { id } });
  if (!c) notFound();
  return (
    <>
      <PageHeader title={`Edit ${c.name}`} />
      <Card className="max-w-3xl p-6">
        <ContractorForm action={updateContractor.bind(null, id)} initial={c} cancelHref={`/contractors/${id}`} submitLabel="Save changes" />
      </Card>
    </>
  );
}

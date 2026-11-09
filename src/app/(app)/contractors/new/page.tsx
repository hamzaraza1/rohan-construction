import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/guards";
import { createContractor } from "@/lib/actions/contractors";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ContractorForm } from "@/components/domain/ContractorForm";

export const metadata: Metadata = { title: "New contractor" };

export default async function NewContractorPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  await requireAdminPage();
  const { returnTo } = await searchParams;
  const back = returnTo?.startsWith("/contracts/new") ? returnTo : undefined;
  return (
    <>
      <PageHeader title="New contractor" description={back ? "After saving you will return to the contract form." : undefined} />
      <Card className="max-w-3xl p-6">
        <ContractorForm action={createContractor} cancelHref={back ?? "/contractors"} submitLabel="Create contractor" returnTo={back} />
      </Card>
    </>
  );
}

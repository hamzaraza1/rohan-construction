import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/guards";
import { createSupplier } from "@/lib/actions/suppliers";
import { supplierCategoryOptions } from "@/lib/queries/suppliers";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { SupplierForm } from "@/components/domain/SupplierForm";

export const metadata: Metadata = { title: "New supplier" };

export default async function NewSupplierPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  await requireAdminPage();
  const { returnTo } = await searchParams;
  const back = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : undefined;
  return (
    <>
      <PageHeader title="New supplier" description={back ? "After saving you will return to the previous form." : undefined} />
      <Card className="max-w-3xl p-6">
        <SupplierForm action={createSupplier} categories={await supplierCategoryOptions()} cancelHref={back ?? "/suppliers"} submitLabel="Create supplier" returnTo={back} />
      </Card>
    </>
  );
}

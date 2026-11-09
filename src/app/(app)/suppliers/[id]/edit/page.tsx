import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guards";
import { dbRead } from "@/lib/db";
import { updateSupplier } from "@/lib/actions/suppliers";
import { supplierCategoryOptions } from "@/lib/queries/suppliers";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { SupplierForm } from "@/components/domain/SupplierForm";

export const metadata: Metadata = { title: "Edit supplier" };

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const s = await dbRead.supplier.findUnique({ where: { id }, include: { categories: { select: { id: true } } } });
  if (!s) notFound();
  return (
    <>
      <PageHeader title={`Edit ${s.name}`} />
      <Card className="max-w-3xl p-6">
        <SupplierForm
          action={updateSupplier.bind(null, id)}
          categories={await supplierCategoryOptions()}
          initial={{ ...s, categoryIds: s.categories.map((c) => c.id) }}
          cancelHref={`/suppliers/${id}`}
          submitLabel="Save changes"
        />
      </Card>
    </>
  );
}

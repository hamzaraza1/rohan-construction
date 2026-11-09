import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dbRead } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guards";
import { CATEGORY_KINDS, isCategoryKind, listCategories } from "@/lib/categories";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmSubmit } from "@/components/ui/ConfirmDialog";
import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { createCategory, deleteCategory, updateCategory } from "./actions";

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }): Promise<Metadata> {
  const { kind } = await params;
  return { title: isCategoryKind(kind) ? CATEGORY_KINDS[kind].title : "Categories" };
}

export default async function CategoriesPage({ params }: { params: Promise<{ kind: string }> }) {
  await requireAdminPage();
  const { kind } = await params;
  if (!isCategoryKind(kind)) notFound();
  const meta = CATEGORY_KINDS[kind];
  const rows = await listCategories(dbRead, kind);
  const isExpense = kind === "expense";

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader title={meta.title} description={meta.description} />
        {rows.length === 0 ? (
          <EmptyState title="No categories yet" />
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((c) => (
              <div key={c.id} className="flex flex-wrap items-end gap-3 px-5 py-4">
                <ActionForm action={updateCategory.bind(null, kind, c.id)} showSuccess={false} className="flex flex-1 flex-wrap items-end gap-3">
                  <Field label="Name" htmlFor={`n-${c.id}`} className="min-w-48 flex-1">
                    <Input id={`n-${c.id}`} name="name" defaultValue={c.name} required />
                  </Field>
                  <Field label="Order" htmlFor={`o-${c.id}`} className="w-20">
                    <Input id={`o-${c.id}`} name="sortOrder" type="number" min={0} defaultValue={c.sortOrder} />
                  </Field>
                  {c.systemKey ? (
                    <input type="hidden" name="isActive" value="on" />
                  ) : (
                    <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" name="isActive" defaultChecked={c.isActive} className="size-4 rounded border-slate-300" />
                      Active
                    </label>
                  )}
                  {isExpense && (
                    <label className="flex h-10 items-center gap-2 text-sm text-slate-700" title="Shown in the separate Miscellaneous / Irregular section">
                      <input type="checkbox" name="isMiscellaneous" defaultChecked={c.isMiscellaneous} className="size-4 rounded border-slate-300" />
                      Misc. section
                    </label>
                  )}
                  <SubmitButton variant="secondary">Save</SubmitButton>
                </ActionForm>
                <div className="flex h-10 items-center gap-2">
                  {c.systemKey && <Badge tone="violet">System</Badge>}
                  {!c.isActive && <Badge tone="red">Inactive</Badge>}
                  <span className="text-xs whitespace-nowrap text-slate-500">{c.usage} in use</span>
                  {!c.systemKey && c.usage === 0 && (
                    <ActionForm action={deleteCategory.bind(null, kind, c.id)}>
                      <ConfirmSubmit
                        label="Delete"
                        title={`Delete "${c.name}"?`}
                        message="This category is not used by any record, so it can be deleted safely."
                        confirmLabel="Delete"
                      />
                    </ActionForm>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="h-fit">
        <CardHeader title={`Add ${meta.singular}`} />
        <ActionForm action={createCategory.bind(null, kind)} resetOnSuccess className="space-y-3 p-5">
          <Field label="Name" htmlFor="new-cat" required>
            <Input id="new-cat" name="name" required />
          </Field>
          {isExpense && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="isMiscellaneous" className="size-4 rounded border-slate-300" />
              Show in Miscellaneous / Irregular section
            </label>
          )}
          <SubmitButton className="w-full">Add</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}

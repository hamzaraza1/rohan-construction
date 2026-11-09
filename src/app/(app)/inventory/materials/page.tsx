import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { listMaterials, materialCategoryOptions } from "@/lib/queries/inventory";
import { createMaterial, updateMaterial } from "@/lib/actions/suppliers";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ActionForm } from "@/components/ui/ActionForm";
import { FormField } from "@/components/ui/FormField";
import { Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

export const metadata: Metadata = { title: "Materials" };

export default async function MaterialsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const [materials, categories] = await Promise.all([listMaterials(), materialCategoryOptions()]);
  return (
    <>
      <PageHeader
        title="Materials catalogue"
        description={<>Materials used in orders, receipts and stock. Categories are managed in <Link href="/settings/categories/material" className="text-brand-700 hover:underline">Settings</Link>.</>}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className={isAdmin ? "xl:col-span-2" : "xl:col-span-3"}>
          <CardHeader title={`${materials.length} material(s)`} />
          {materials.length === 0 ? (
            <EmptyState title="No materials yet" description="Add cement, steel, bricks and so on." />
          ) : isAdmin ? (
            <div className="divide-y divide-slate-100">
              {materials.map((m) => {
                const used = m._count.receiptLines + m._count.poLines + m._count.stockMovements > 0;
                return (
                  <ActionForm key={m.id} action={updateMaterial.bind(null, m.id)} showSuccess={false} className="flex flex-wrap items-end gap-3 px-5 py-3">
                    <FormField label="Name" name="name" htmlFor={`n-${m.id}`} className="min-w-44 flex-1">
                      <Input id={`n-${m.id}`} name="name" defaultValue={m.name} required />
                    </FormField>
                    <FormField label="Unit" name="unit" htmlFor={`u-${m.id}`} className="w-24" hint={used ? "Locked (in use)" : undefined}>
                      <Input id={`u-${m.id}`} name="unit" defaultValue={m.unit} required readOnly={used} className={used ? "bg-slate-50" : undefined} />
                    </FormField>
                    <FormField label="Category" name="categoryId" htmlFor={`c-${m.id}`} className="w-44">
                      <Select id={`c-${m.id}`} name="categoryId" defaultValue={m.categoryId}>
                        {!categories.some((c) => c.id === m.categoryId) && <option value={m.categoryId}>{m.category.name}</option>}
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </Select>
                    </FormField>
                    <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" name="isActive" defaultChecked={m.isActive} className="size-4 rounded border-slate-300" /> Active
                    </label>
                    <SubmitButton variant="secondary">Save</SubmitButton>
                  </ActionForm>
                );
              })}
            </div>
          ) : (
            <Table>
              <THead><tr><TH>Material</TH><TH>Unit</TH><TH>Category</TH></tr></THead>
              <TBody>
                {materials.map((m) => (
                  <TR key={m.id}>
                    <TD className="font-medium">{m.name} {!m.isActive && <Badge tone="red">Inactive</Badge>}</TD>
                    <TD>{m.unit}</TD>
                    <TD>{m.category.name}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
        {isAdmin && (
          <Card className="h-fit">
            <CardHeader title="Add material" />
            <ActionForm action={createMaterial} resetOnSuccess className="space-y-3 p-5">
              <FormField label="Material name" name="name" htmlFor="new-name" required>
                <Input id="new-name" name="name" required placeholder="e.g. OPC Cement (50 kg)" />
              </FormField>
              <FormField label="Unit" name="unit" htmlFor="new-unit" required hint="bag, ton, kg, cft, piece, sq.ft, litre…">
                <Input id="new-unit" name="unit" required />
              </FormField>
              <FormField label="Category" name="categoryId" htmlFor="new-cat" required>
                <Select id="new-cat" name="categoryId" required defaultValue="">
                  <option value="">Select…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </FormField>
              <SubmitButton className="w-full">Add material</SubmitButton>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}

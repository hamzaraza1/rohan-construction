import type { Metadata } from "next";
import { db, dbRead } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guards";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmSubmit } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { createPartner, deletePartner, updatePartner } from "./actions";

export const metadata: Metadata = { title: "Partners" };

export default async function PartnersPage() {
  await requireAdminPage();
  const [partners, users] = await Promise.all([
    dbRead.partner.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { withdrawals: true } } },
    }),
    db.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, username: true } }),
  ]);

  const userOptions = (
    <>
      <option value="">— Not linked —</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
      ))}
    </>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader
          title="Partners"
          description="Business partners who can make personal withdrawals from project funds. Linking a partner to a login is optional."
        />
        {partners.length === 0 ? (
          <EmptyState title="No partners yet" description="Add the three business partners here." />
        ) : (
          <div className="divide-y divide-slate-100">
            {partners.map((p) => (
              <div key={p.id} className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="font-medium text-slate-900">{p.name}</span>
                  {!p.isActive && <Badge tone="red">Inactive</Badge>}
                  <span className="ml-auto text-xs text-slate-500">{p._count.withdrawals} withdrawal record(s)</span>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <ActionForm action={updatePartner.bind(null, p.id)} className="flex flex-1 flex-wrap items-end gap-3">
                    <Field label="Name" htmlFor={`pn-${p.id}`} className="min-w-44 flex-1">
                      <Input id={`pn-${p.id}`} name="name" defaultValue={p.name} required />
                    </Field>
                    <Field label="Linked login" htmlFor={`pu-${p.id}`} className="min-w-44 flex-1">
                      <Select id={`pu-${p.id}`} name="userId" defaultValue={p.userId ?? ""}>{userOptions}</Select>
                    </Field>
                    <Field label="Order" htmlFor={`po-${p.id}`} className="w-20">
                      <Input id={`po-${p.id}`} name="sortOrder" type="number" min={0} defaultValue={p.sortOrder} />
                    </Field>
                    <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" name="isActive" defaultChecked={p.isActive} className="size-4 rounded border-slate-300" />
                      Active
                    </label>
                    <SubmitButton variant="secondary">Save</SubmitButton>
                  </ActionForm>
                  {p._count.withdrawals === 0 && (
                    <ActionForm action={deletePartner.bind(null, p.id)}>
                      <ConfirmSubmit
                        label="Delete"
                        size="md"
                        title={`Delete partner "${p.name}"?`}
                        message="This partner has no withdrawal records, so it can be removed safely."
                        confirmLabel="Delete partner"
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
        <CardHeader title="Add partner" />
        <ActionForm action={createPartner} resetOnSuccess className="space-y-3 p-5">
          <Field label="Partner name" htmlFor="partner-name" required>
            <Input id="partner-name" name="name" required />
          </Field>
          <Field label="Linked login (optional)" htmlFor="partner-user">
            <Select id="partner-user" name="userId" defaultValue="">{userOptions}</Select>
          </Field>
          <Field label="Display order" htmlFor="partner-order">
            <Input id="partner-order" name="sortOrder" type="number" min={0} defaultValue={partners.length} />
          </Field>
          <SubmitButton className="w-full">Add partner</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}

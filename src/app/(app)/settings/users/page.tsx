import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ActionForm } from "@/components/ui/ActionForm";
import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { createUser, resetUserPassword, updateUser } from "./actions";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requireAdminPage();
  // Credentials are not exposed to the read-only role, so this admin-only
  // page reads users through the owner connection (selecting no secrets).
  const users = await db.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, username: true, email: true, role: true, isActive: true, lastLoginAt: true, lockedUntil: true },
  });

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        {users.map((u) => (
          <Card key={u.id} className="p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-slate-900">{u.name}</h3>
              <span className="text-sm text-slate-500">@{u.username}</span>
              <Badge tone={u.role === "ADMIN" ? "blue" : "slate"}>{u.role === "ADMIN" ? "Admin" : "Read-only"}</Badge>
              {!u.isActive && <Badge tone="red">Inactive</Badge>}
              {u.lockedUntil && u.lockedUntil > new Date() && <Badge tone="amber">Locked</Badge>}
              {u.id === me.id && <Badge tone="green">You</Badge>}
              <span className="ml-auto text-xs text-slate-500">Last sign-in: {formatDateTime(u.lastLoginAt)}</span>
            </div>
            <ActionForm action={updateUser.bind(null, u.id)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
              <Field label="Name" htmlFor={`name-${u.id}`}>
                <Input id={`name-${u.id}`} name="name" defaultValue={u.name} required />
              </Field>
              <Field label="Email" htmlFor={`email-${u.id}`}>
                <Input id={`email-${u.id}`} name="email" type="email" defaultValue={u.email ?? ""} />
              </Field>
              <Field label="Access" htmlFor={`role-${u.id}`}>
                <Select id={`role-${u.id}`} name="role" defaultValue={u.role}>
                  <option value="VIEWER">Read-only partner</option>
                  <option value="ADMIN">Administrator</option>
                </Select>
              </Field>
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="isActive" defaultChecked={u.isActive} className="size-4 rounded border-slate-300" />
                  Active
                </label>
                <SubmitButton variant="secondary">Save</SubmitButton>
              </div>
            </ActionForm>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-brand-700">Reset password</summary>
              <ActionForm action={resetUserPassword.bind(null, u.id)} resetOnSuccess className="mt-3 flex flex-wrap items-end gap-3">
                <Field label="New password" htmlFor={`pw-${u.id}`} className="min-w-60 flex-1">
                  <Input id={`pw-${u.id}`} name="password" type="password" autoComplete="new-password" minLength={10} required />
                </Field>
                <SubmitButton variant="secondary">Set password</SubmitButton>
              </ActionForm>
            </details>
          </Card>
        ))}
      </div>

      <Card className="h-fit">
        <CardHeader title="Add user" description="Partners should normally get read-only access." />
        <ActionForm action={createUser} resetOnSuccess className="space-y-3 p-5">
          <Field label="Full name" htmlFor="new-name" required>
            <Input id="new-name" name="name" required />
          </Field>
          <Field label="Username" htmlFor="new-username" required hint="Used to sign in">
            <Input id="new-username" name="username" autoCapitalize="none" required />
          </Field>
          <Field label="Email" htmlFor="new-email">
            <Input id="new-email" name="email" type="email" />
          </Field>
          <Field label="Access" htmlFor="new-role">
            <Select id="new-role" name="role" defaultValue="VIEWER">
              <option value="VIEWER">Read-only partner</option>
              <option value="ADMIN">Administrator</option>
            </Select>
          </Field>
          <Field label="Initial password" htmlFor="new-password" required hint="At least 10 characters. Ask the user to change it after first sign-in.">
            <Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={10} required />
          </Field>
          <SubmitButton className="w-full">Create user</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}

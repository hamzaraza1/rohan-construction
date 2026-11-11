"use client";

import { useStore } from "@/lib/store";
import { checkEmail, clean, required, useForm } from "@/lib/form";
import type { Category, Partner, Role, User } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Checkbox, FormField, Input, Segmented, Select } from "@/components/ui/Field";
import { FormModal, Grid, InfoBox } from "./common";

export function UserForm({ onClose, user }: { onClose: () => void; user?: User }) {
  const { data, add, update } = useStore();
  const toast = useToast();
  const f = useForm(
    { name: user?.name ?? "", email: user?.email ?? "", role: (user?.role ?? "PARTNER") as Role, password: "", isActive: user?.isActive ?? true },
    (v) =>
      clean({
        name: required(v.name, "Name"),
        email: checkEmail(v.email, true) ?? (data.users.some((u) => u.email.toLowerCase() === v.email.trim().toLowerCase() && u.id !== user?.id) ? "This email is already used" : undefined),
        password: !user && v.password.length < 10 ? "Use at least 10 characters" : user && v.password && v.password.length < 10 ? "Use at least 10 characters" : undefined,
      }),
  );
  const submit = f.handleSubmit((v) => {
    const row = { name: v.name.trim(), email: v.email.trim().toLowerCase(), role: v.role, isActive: v.isActive };
    if (user) update("users", user.id, row);
    else add("users", row);
    toast(user ? "User updated" : `User “${row.name}” added`);
    onClose();
  });
  return (
    <FormModal title={user ? "Edit user" : "Add user"} onClose={onClose} onSubmit={submit} submitLabel={user ? "Save changes" : "Add user"}>
      <Grid>
        <FormField label="Full name" htmlFor="name" required error={f.errors.name}>
          <Input {...f.bind("name")} />
        </FormField>
        <FormField label="Email (login)" htmlFor="email" required error={f.errors.email}>
          <Input {...f.bind("email")} type="email" />
        </FormField>
      </Grid>
      <FormField label="Access" required>
        <Segmented name="role" value={f.values.role} onChange={(r) => f.set("role", r)} options={[{ value: "ADMIN", label: "Admin (full access)" }, { value: "PARTNER", label: "Partner (read-only)" }]} />
      </FormField>
      <FormField label={user ? "New password" : "Temporary password"} htmlFor="password" required={!user} error={f.errors.password} hint={user ? "Leave blank to keep the current password" : "The user should change it after first sign-in"}>
        <Input {...f.bind("password")} type="password" autoComplete="new-password" />
      </FormField>
      {user && <Checkbox label="Account active" description="Inactive users cannot sign in" checked={f.values.isActive} onChange={(e) => f.set("isActive", e.target.checked)} />}
      <InfoBox>Partners can see every screen and report but cannot add, edit or delete anything. In Stage 2 this is enforced on the server and in the database, not just in the screens.</InfoBox>
    </FormModal>
  );
}

export function PartnerForm({ onClose, partner }: { onClose: () => void; partner?: Partner }) {
  const { data, add, update } = useStore();
  const toast = useToast();
  const otherShare = data.partners.filter((p) => p.id !== partner?.id).reduce((t, p) => t + p.sharePercent, 0);
  const f = useForm(
    { name: partner?.name ?? "", phone: partner?.phone ?? "", sharePercent: String(partner?.sharePercent ?? ""), userId: partner?.userId ?? "" },
    (v) => {
      const n = Number(v.sharePercent);
      return clean({
        name: required(v.name, "Name"),
        sharePercent: !/^\d+(\.\d{1,2})?$/.test(v.sharePercent) ? "Enter a percentage" : n + otherShare > 100 ? `Total share would be ${n + otherShare}%. Maximum is 100%.` : undefined,
      });
    },
  );
  const submit = f.handleSubmit((v) => {
    const row = { name: v.name.trim(), phone: v.phone.trim() || undefined, sharePercent: Number(v.sharePercent), userId: v.userId || undefined };
    if (partner) update("partners", partner.id, row);
    else add("partners", row);
    toast(partner ? "Partner updated" : `Partner “${row.name}” added`);
    onClose();
  });
  return (
    <FormModal title={partner ? "Edit partner" : "Add partner"} onClose={onClose} onSubmit={submit} size="sm" submitLabel={partner ? "Save" : "Add partner"}>
      <FormField label="Partner name" htmlFor="name" required error={f.errors.name}>
        <Input {...f.bind("name")} />
      </FormField>
      <Grid>
        <FormField label="Phone" htmlFor="phone">
          <Input {...f.bind("phone")} />
        </FormField>
        <FormField label="Share (%)" htmlFor="sharePercent" required error={f.errors.sharePercent} hint={`Others: ${otherShare}%`}>
          <Input {...f.bind("sharePercent")} inputMode="decimal" />
        </FormField>
      </Grid>
      <FormField label="Linked login" htmlFor="userId" hint="Optional: the user account this partner signs in with">
        <Select {...f.bind("userId")}>
          <option value="">None</option>
          {data.users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
        </Select>
      </FormField>
    </FormModal>
  );
}

export function CategoryForm({ onClose, category, kind, label }: { onClose: () => void; category?: Category; kind: "expenseCategories" | "materialCategories" | "workCategories"; label: string }) {
  const { data, add, update } = useStore();
  const toast = useToast();
  const list = data[kind];
  const f = useForm(
    { name: category?.name ?? "", isMiscellaneous: category?.isMiscellaneous ?? false, isActive: category?.isActive ?? true },
    (v) => clean({ name: required(v.name, "Name") ?? (list.some((c) => c.name.toLowerCase() === v.name.trim().toLowerCase() && c.id !== category?.id) ? "This name already exists" : undefined) }),
  );
  const submit = f.handleSubmit((v) => {
    const row = { name: v.name.trim(), isActive: v.isActive, ...(kind === "expenseCategories" ? { isMiscellaneous: v.isMiscellaneous } : {}) };
    if (category) update(kind, category.id, row);
    else add(kind, row);
    toast(category ? "Category updated" : `“${row.name}” added`);
    onClose();
  });
  return (
    <FormModal title={category ? `Edit ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`} onClose={onClose} onSubmit={submit} size="sm" submitLabel={category ? "Save" : "Add"}>
      <FormField label="Name" htmlFor="name" required error={f.errors.name}>
        <Input {...f.bind("name")} />
      </FormField>
      {kind === "expenseCategories" && <Checkbox label="Miscellaneous / irregular" description="Shown in the separate Miscellaneous section" checked={f.values.isMiscellaneous} onChange={(e) => f.set("isMiscellaneous", e.target.checked)} />}
      {category && <Checkbox label="Active" description="Inactive categories stay on old records but are hidden from new entries" checked={f.values.isActive} onChange={(e) => f.set("isActive", e.target.checked)} />}
    </FormModal>
  );
}

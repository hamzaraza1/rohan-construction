"use client";

import { Suspense, useState } from "react";
import { Building, Hammer, Layers, Plus, RotateCcw, Shapes, ShieldCheck, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { useTab } from "@/lib/use-tab";
import { clean, required, useForm } from "@/lib/form";
import { formatDateTime } from "@/lib/format";
import type { Category, Partner, User } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable } from "@/components/ui/DataTable";
import { Checkbox, FormField, Input, Select } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { CategoryForm, PartnerForm, UserForm } from "@/components/forms/settings";
import { RowActions } from "@/components/domain/RowActions";
import { ReadOnlyNotice } from "@/components/domain/ReadOnlyNotice";

const TABS = ["users", "partners", "expense", "material", "work", "general"] as const;
type Kind = "expenseCategories" | "materialCategories" | "workCategories";

function CategoryList({ kind, label, usage }: { kind: Kind; label: string; usage: (id: string) => number }) {
  const { data, update, remove } = useStore();
  const toast = useToast();
  const [form, setForm] = useState<{ category?: Category } | null>(null);
  return (
    <Card>
      <CardHeader
        title={`${label}s`}
        description="Categories in use cannot be deleted. Deactivate them to hide them from new entries."
        actions={<Button size="sm" onClick={() => setForm({})}><Plus className="size-4" /> Add {label.toLowerCase()}</Button>}
      />
      <DataTable
        rows={data[kind]}
        rowKey={(r) => r.id}
        searchText={(r) => r.name}
        pageSize={25}
        initialSort={{ key: "name", dir: "asc" }}
        columns={[
          { key: "name", header: "Name", sortValue: (r) => r.name, render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
          ...(kind === "expenseCategories" ? [{ key: "type", header: "Section", render: (r: Category) => (r.isMiscellaneous ? <Badge tone="violet">Miscellaneous</Badge> : <Badge>Regular</Badge>) }] : []),
          { key: "used", header: "Used in", align: "center", sortValue: (r) => usage(r.id), render: (r) => `${usage(r.id)} records` },
          {
            key: "active",
            header: "Active",
            align: "center",
            render: (r) => (
              <button
                type="button"
                role="switch"
                aria-checked={r.isActive}
                aria-label={`${r.isActive ? "Deactivate" : "Activate"} ${r.name}`}
                onClick={() => {
                  update(kind, r.id, { isActive: !r.isActive });
                  toast(`${r.name} ${r.isActive ? "deactivated" : "activated"}`);
                }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${r.isActive ? "bg-emerald-500" : "bg-slate-300"}`}
              >
                <span className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${r.isActive ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            ),
          },
          { key: "actions", header: <span className="sr-only">Actions</span>, render: (r) => <RowActions onEdit={() => setForm({ category: r })} onDelete={() => remove(kind, r.id)} disabledReason={usage(r.id) > 0 ? `“${r.name}” is used by ${usage(r.id)} records. Deactivate it instead.` : undefined} deleteTitle={`Delete “${r.name}”?`} /> },
        ]}
      />
      {form && <CategoryForm kind={kind} label={label} category={form.category} onClose={() => setForm(null)} />}
    </Card>
  );
}

function GeneralSettings() {
  const { data, updateSettings, reset } = useStore();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const f = useForm(
    { ...data.settings },
    (v) => clean({ companyName: required(v.companyName, "Company name") }),
  );
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Company" description="Shown on reports and printouts" />
        <form
          noValidate
          onSubmit={f.handleSubmit((v) => {
            updateSettings(v);
            toast("Settings saved");
          })}
          className="grid gap-4 p-5 sm:grid-cols-2"
        >
          <FormField label="Company name" htmlFor="companyName" required error={f.errors.companyName}>
            <Input {...f.bind("companyName")} />
          </FormField>
          <FormField label="Phone" htmlFor="companyPhone">
            <Input {...f.bind("companyPhone")} />
          </FormField>
          <FormField label="Office address" htmlFor="companyAddress" className="sm:col-span-2">
            <Input {...f.bind("companyAddress")} />
          </FormField>
          <FormField label="Currency" htmlFor="currencyLabel" hint="All amounts are in Pakistani Rupees">
            <Select {...f.bind("currencyLabel")} disabled><option>Rs.</option></Select>
          </FormField>
          <FormField label="Date format" htmlFor="dateFormat">
            <Select {...f.bind("dateFormat")}><option value="DD MMM YYYY">09 Nov 2026</option></Select>
          </FormField>
          <div className="sm:col-span-2">
            <Checkbox label="Low-stock highlights" description="Mark materials with less than 10% of received quantity left" checked={f.values.lowStockAlerts} onChange={(e) => f.set("lowStockAlerts", e.target.checked)} />
          </div>
          <div className="flex justify-end sm:col-span-2"><Button type="submit">Save settings</Button></div>
        </form>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Security" />
          <ul className="space-y-3 p-5 text-sm text-slate-600">
            <li className="flex gap-2"><ShieldCheck className="size-4 shrink-0 text-emerald-600" />Partners have read-only access to every module.</li>
            <li className="flex gap-2"><ShieldCheck className="size-4 shrink-0 text-emerald-600" />Every change is recorded in an audit log (Stage 2).</li>
            <li className="flex gap-2"><ShieldCheck className="size-4 shrink-0 text-emerald-600" />Daily backups with off-site copy (Stage 3).</li>
          </ul>
        </Card>
        <Card>
          <CardHeader title="Demo data" description="Frontend preview only" />
          <div className="space-y-3 p-5 text-sm text-slate-600">
            <p>Your changes in this preview are saved in this browser only. Reset to bring back the original sample data.</p>
            <Button variant="secondary" onClick={() => setConfirm(true)}><RotateCcw className="size-4" /> Reset demo data</Button>
          </div>
        </Card>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          reset();
          toast("Demo data reset");
        }}
        title="Reset demo data?"
        message="Everything you added or changed in this preview will be replaced with the original sample data."
        confirmLabel="Reset"
      />
    </div>
  );
}

function SettingsPage() {
  const { data, canEdit, remove } = useStore();
  const [tab, setTab] = useTab<(typeof TABS)[number]>("users", TABS);
  const [userForm, setUserForm] = useState<{ user?: User } | null>(null);
  const [partnerForm, setPartnerForm] = useState<{ partner?: Partner } | null>(null);

  if (!canEdit) return (<><PageHeader title="Settings" /><ReadOnlyNotice /></>);

  const count = <T,>(rows: T[], f: (r: T) => boolean) => rows.filter(f).length;

  return (
    <>
      <PageHeader title="Settings" description="Administrator only" />
      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "users", label: "Users", icon: <Users className="size-4" />, count: data.users.length },
          { value: "partners", label: "Partners", icon: <Users className="size-4" />, count: data.partners.length },
          { value: "expense", label: "Expense categories", icon: <Shapes className="size-4" /> },
          { value: "material", label: "Material categories", icon: <Layers className="size-4" /> },
          { value: "work", label: "Contractor work categories", icon: <Hammer className="size-4" /> },
          { value: "general", label: "General", icon: <Building className="size-4" /> },
        ]}
      />

      {tab === "users" && (
        <Card>
          <CardHeader title="Users & access" description="Admin has full access. Partners can view everything but cannot change anything." actions={<Button size="sm" onClick={() => setUserForm({})}><Plus className="size-4" /> Add user</Button>} />
          <DataTable
            rows={data.users}
            rowKey={(r) => r.id}
            initialSort={{ key: "name", dir: "asc" }}
            columns={[
              { key: "name", header: "Name", sortValue: (r) => r.name, render: (r) => <div><div className="font-medium text-slate-900">{r.name}</div><div className="text-xs text-slate-500">{r.email}</div></div> },
              { key: "role", header: "Role", sortValue: (r) => r.role, render: (r) => (r.role === "ADMIN" ? <Badge tone="blue">Admin · full access</Badge> : <Badge tone="amber">Partner · read-only</Badge>) },
              { key: "status", header: "Status", render: (r) => (r.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>) },
              { key: "last", header: "Last sign-in", sortValue: (r) => r.lastLogin ?? "", render: (r) => <span className="whitespace-nowrap">{r.lastLogin ? formatDateTime(r.lastLogin) : "Never"}</span> },
              { key: "actions", header: <span className="sr-only">Actions</span>, render: (r) => <RowActions onEdit={() => setUserForm({ user: r })} onDelete={() => remove("users", r.id)} disabledReason={r.role === "ADMIN" && count(data.users, (u) => u.role === "ADMIN" && u.isActive) <= 1 ? "You cannot delete the only administrator." : undefined} deleteTitle={`Delete ${r.name}?`} deleteMessage="They will no longer be able to sign in." /> },
            ]}
          />
        </Card>
      )}

      {tab === "partners" && (
        <Card>
          <CardHeader title="Partners" description="Used for partner withdrawals. Names and shares are editable." actions={<Button size="sm" onClick={() => setPartnerForm({})}><Plus className="size-4" /> Add partner</Button>} />
          <DataTable
            rows={data.partners}
            rowKey={(r) => r.id}
            columns={[
              { key: "name", header: "Partner", render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
              { key: "phone", header: "Phone", render: (r) => r.phone ?? "—" },
              { key: "share", header: "Share", align: "right", render: (r) => `${r.sharePercent}%` },
              { key: "user", header: "Login", render: (r) => data.users.find((u) => u.id === r.userId)?.email ?? "—" },
              { key: "w", header: "Withdrawals", align: "center", render: (r) => count(data.withdrawals, (w) => w.partnerId === r.id) },
              { key: "actions", header: <span className="sr-only">Actions</span>, render: (r) => <RowActions onEdit={() => setPartnerForm({ partner: r })} onDelete={() => remove("partners", r.id)} disabledReason={data.withdrawals.some((w) => w.partnerId === r.id) ? "This partner has withdrawals and cannot be deleted." : undefined} deleteTitle={`Delete ${r.name}?`} /> },
            ]}
            footer={(rs) => (
              <tr>
                <td className="px-4 py-3" colSpan={2}>Total share</td>
                <td className={`tabular px-4 py-3 text-right ${rs.reduce((t, r) => t + r.sharePercent, 0) !== 100 ? "text-amber-700" : ""}`}>{rs.reduce((t, r) => t + r.sharePercent, 0)}%</td>
                <td colSpan={3} />
              </tr>
            )}
          />
        </Card>
      )}

      {tab === "expense" && <CategoryList kind="expenseCategories" label="Expense category" usage={(id) => count(data.expenses, (e) => e.categoryId === id)} />}
      {tab === "material" && <CategoryList kind="materialCategories" label="Material category" usage={(id) => count(data.materials, (m) => m.categoryId === id) + count(data.suppliers, (s) => s.materialCategoryIds.includes(id))} />}
      {tab === "work" && <CategoryList kind="workCategories" label="Work category" usage={(id) => count(data.contracts, (c) => c.workCategoryId === id) + count(data.contractors, (c) => c.specializationIds.includes(id))} />}
      {tab === "general" && <GeneralSettings />}

      {userForm && <UserForm user={userForm.user} onClose={() => setUserForm(null)} />}
      {partnerForm && <PartnerForm partner={partnerForm.partner} onClose={() => setPartnerForm(null)} />}
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <SettingsPage />
    </Suspense>
  );
}

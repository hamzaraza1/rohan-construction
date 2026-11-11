"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PackagePlus, Plus, Truck, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import { supplierTotals, sum } from "@/lib/calculations";
import { formatMoney } from "@/lib/format";
import type { Supplier } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, StatCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable, FilterSelect, type Column } from "@/components/ui/DataTable";
import { DeliveryForm, SupplierForm, SupplierPaymentForm } from "@/components/forms/suppliers";
import { RowActions } from "@/components/domain/RowActions";

export default function SuppliersPage() {
  const { data, canEdit, remove } = useStore();
  const router = useRouter();
  const [form, setForm] = useState<{ supplier?: Supplier } | null>(null);
  const [other, setOther] = useState<"delivery" | "pay">();
  const [cat, setCat] = useState("");
  const [balance, setBalance] = useState("");

  const all = useMemo(() => data.suppliers.map((s) => ({ ...s, t: supplierTotals(data, s.id) })), [data]);
  const rows = all.filter((s) => (!cat || s.materialCategoryIds.includes(cat)) && (!balance || (balance === "owed" ? s.t.outstanding > 0 : s.t.advance > 0)));
  type R = (typeof rows)[number];

  const columns: Column<R>[] = [
    {
      key: "name",
      header: "Supplier",
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="min-w-44">
          <Link href={`/suppliers/${r.id}`} className="font-medium text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>{r.name}</Link>
          <div className="text-xs text-slate-500">{r.contactPerson ? `${r.contactPerson} · ` : ""}{r.phone}</div>
        </div>
      ),
    },
    { key: "cats", header: "Supplies", render: (r) => <div className="flex max-w-xs flex-wrap gap-1">{r.materialCategoryIds.map((id) => <Badge key={id}>{data.materialCategories.find((c) => c.id === id)?.name}</Badge>)}{!r.isActive && <Badge tone="red">Inactive</Badge>}</div> },
    { key: "delivered", header: "Material received", align: "right", sortValue: (r) => r.t.delivered, render: (r) => formatMoney(r.t.delivered) },
    { key: "paid", header: "Paid", align: "right", sortValue: (r) => r.t.paid, render: (r) => formatMoney(r.t.paid) },
    { key: "advance", header: "Advance", align: "right", sortValue: (r) => r.t.advance, render: (r) => (r.t.advance > 0 ? <span className="font-medium text-blue-700">{formatMoney(r.t.advance)}</span> : <span className="text-slate-300">—</span>) },
    { key: "outstanding", header: "Outstanding", align: "right", sortValue: (r) => r.t.outstanding, render: (r) => <span className={r.t.outstanding > 0 ? "font-semibold text-amber-700" : "text-slate-400"}>{formatMoney(r.t.outstanding)}</span> },
    { key: "actions", header: <span className="sr-only">Actions</span>, render: (r) => <RowActions onEdit={() => setForm({ supplier: r })} onDelete={() => remove("suppliers", r.id)} disabledReason={r.t.delivered > 0 || r.t.paid > 0 ? "This supplier has deliveries or payments. Mark it inactive instead." : undefined} deleteTitle={`Delete ${r.name}?`} /> },
  ];

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Material suppliers: what was delivered, what was paid, and what is still owed"
        actions={
          canEdit && (
            <>
              <Button variant="secondary" onClick={() => setOther("delivery")}><PackagePlus className="size-4" /> Receive material</Button>
              <Button variant="secondary" onClick={() => setOther("pay")}><Wallet className="size-4" /> Pay supplier</Button>
              <Button onClick={() => setForm({})}><Plus className="size-4" /> Add supplier</Button>
            </>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Material received" value={formatMoney(sum(all, (s) => s.t.delivered))} hint="Value of all deliveries" icon={<Truck className="size-5" />} tone="brand" />
        <StatCard label="Paid to suppliers" value={formatMoney(sum(all, (s) => s.t.paid))} icon={<Wallet className="size-5" />} />
        <StatCard label="Advances with suppliers" value={formatMoney(sum(all, (s) => s.t.advance))} hint="Paid, material not yet delivered" tone="brand" />
        <StatCard label="Outstanding to suppliers" value={formatMoney(sum(all, (s) => s.t.outstanding))} hint="Received but not yet paid" tone="warning" />
      </div>
      <Card className="mt-6">
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/suppliers/${r.id}`)}
          searchText={(r) => `${r.name} ${r.contactPerson ?? ""} ${r.phone} ${r.address ?? ""}`}
          searchPlaceholder="Search supplier, contact, phone…"
          initialSort={{ key: "outstanding", dir: "desc" }}
          toolbar={
            <>
              <FilterSelect label="Material category" value={cat} onChange={setCat}>
                <option value="">All materials</option>
                {data.materialCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </FilterSelect>
              <FilterSelect label="Balance" value={balance} onChange={setBalance}>
                <option value="">Any balance</option>
                <option value="owed">We owe them</option>
                <option value="advance">They hold our advance</option>
              </FilterSelect>
            </>
          }
          footer={(rs) => (
            <tr>
              <td className="px-4 py-3" colSpan={2}>Total ({rs.length})</td>
              <td className="tabular px-4 py-3 text-right">{formatMoney(sum(rs, (r) => r.t.delivered))}</td>
              <td className="tabular px-4 py-3 text-right">{formatMoney(sum(rs, (r) => r.t.paid))}</td>
              <td className="tabular px-4 py-3 text-right text-blue-700">{formatMoney(sum(rs, (r) => r.t.advance))}</td>
              <td className="tabular px-4 py-3 text-right text-amber-700">{formatMoney(sum(rs, (r) => r.t.outstanding))}</td>
              <td />
            </tr>
          )}
        />
      </Card>
      {form && <SupplierForm supplier={form.supplier} onClose={() => setForm(null)} />}
      {other === "delivery" && <DeliveryForm onClose={() => setOther(undefined)} />}
      {other === "pay" && <SupplierPaymentForm onClose={() => setOther(undefined)} />}
    </>
  );
}

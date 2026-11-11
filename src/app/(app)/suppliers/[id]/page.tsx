"use client";

import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import { MapPin, PackagePlus, Pencil, Phone, Truck, User, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import { useTab } from "@/lib/use-tab";
import { supplierTotals } from "@/lib/calculations";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeliveryForm, SupplierForm, SupplierPaymentForm } from "@/components/forms/suppliers";
import { DeliveriesTable, SupplierAccountsTable, SupplierPaymentsTable } from "@/components/domain/Tables";

const TABS = ["balances", "deliveries", "payments"] as const;

function SupplierPage() {
  const { id } = useParams<{ id: string }>();
  const { data, canEdit } = useStore();
  const [tab, setTab] = useTab<(typeof TABS)[number]>("balances", TABS);
  const [form, setForm] = useState<"edit" | "delivery" | "pay">();
  const s = data.suppliers.find((x) => x.id === id);
  if (!s) return <Card><EmptyState title="Supplier not found" action={<ButtonLink href="/suppliers" variant="secondary">Back to suppliers</ButtonLink>} /></Card>;
  const t = supplierTotals(data, s.id);
  const close = () => setForm(undefined);
  const deliveries = data.deliveries.filter((d) => d.supplierId === s.id).length;
  const payments = data.supplierPayments.filter((p) => p.supplierId === s.id).length;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Suppliers", href: "/suppliers" }, { label: s.name }]}
        title={s.name}
        meta={
          <>
            {s.contactPerson && <span className="flex items-center gap-1.5"><User className="size-4 text-slate-400" />{s.contactPerson}</span>}
            <span className="flex items-center gap-1.5"><Phone className="size-4 text-slate-400" />{s.phone}</span>
            {s.address && <span className="flex items-center gap-1.5"><MapPin className="size-4 text-slate-400" />{s.address}</span>}
            <span className="flex flex-wrap gap-1">{s.materialCategoryIds.map((c) => <Badge key={c} tone="blue">{data.materialCategories.find((x) => x.id === c)?.name}</Badge>)}</span>
          </>
        }
        actions={
          canEdit && (
            <>
              <Button variant="secondary" onClick={() => setForm("edit")}><Pencil className="size-4" /> Edit</Button>
              <Button variant="secondary" onClick={() => setForm("pay")}><Wallet className="size-4" /> Pay / advance</Button>
              <Button onClick={() => setForm("delivery")}><PackagePlus className="size-4" /> Receive material</Button>
            </>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Material received" value={formatMoney(t.delivered)} hint={`${deliveries} deliveries · ${t.projects} project(s)`} icon={<Truck className="size-5" />} tone="brand" />
        <StatCard label="Paid" value={formatMoney(t.paid)} hint={`${payments} payments incl. advances`} icon={<Wallet className="size-5" />} />
        <StatCard label="Advance with supplier" value={formatMoney(t.advance)} hint="Paid but not yet delivered" tone={t.advance > 0 ? "brand" : "default"} />
        <StatCard label="Outstanding balance" value={formatMoney(t.outstanding)} hint="Delivered but not yet paid" tone={t.outstanding > 0 ? "warning" : "positive"} />
      </div>

      <Tabs className="mt-6 mb-6" value={tab} onChange={setTab} tabs={[{ value: "balances", label: "Balance by project" }, { value: "deliveries", label: "Material deliveries", count: deliveries }, { value: "payments", label: "Advances & payments", count: payments }]} />

      {tab === "balances" && (
        <Card>
          <CardHeader title="Balance by project" description="Each project keeps its own account with the supplier, so advances on one site are never mixed with another." />
          <SupplierAccountsTable supplierId={s.id} />
        </Card>
      )}
      {tab === "deliveries" && (
        <Card>
          <CardHeader title="Purchase & delivery history" description="Material actually received at site. Click a row for the item breakdown." />
          <DeliveriesTable supplierId={s.id} />
        </Card>
      )}
      {tab === "payments" && (
        <Card>
          <CardHeader title="Advances & payments" />
          <SupplierPaymentsTable supplierId={s.id} />
        </Card>
      )}

      {form === "edit" && <SupplierForm supplier={s} onClose={close} />}
      {form === "delivery" && <DeliveryForm supplierId={s.id} onClose={close} />}
      {form === "pay" && <SupplierPaymentForm supplierId={s.id} onClose={close} />}
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <SupplierPage />
    </Suspense>
  );
}

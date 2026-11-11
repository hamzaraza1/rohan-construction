"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { projectFinancials, sum } from "@/lib/calculations";
import { formatDate, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ClientForm } from "@/components/forms/clients";
import { RowActions } from "@/components/domain/RowActions";
import type { Client } from "@/lib/types";

export default function ClientsPage() {
  const { data, canEdit, remove } = useStore();
  const router = useRouter();
  const [form, setForm] = useState<{ client?: Client } | null>(null);

  const rows = useMemo(
    () =>
      data.clients.map((c) => {
        const projects = data.projects.filter((p) => p.clientId === c.id);
        const fins = projects.map((p) => projectFinancials(data, p.id));
        return {
          ...c,
          projects: projects.length,
          activeProjects: projects.filter((p) => p.status === "ACTIVE").length,
          contract: sum(projects, (p) => p.contractValue),
          received: sum(fins, (f) => f.received),
          due: sum(fins, (f) => f.clientBalance),
        };
      }),
    [data],
  );
  type R = (typeof rows)[number];

  const columns: Column<R>[] = [
    {
      key: "name",
      header: "Client",
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="min-w-48">
          <Link href={`/clients/${r.id}`} className="font-medium text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>{r.name}</Link>
          <div className="text-xs text-slate-500">{r.phone}{r.email ? ` · ${r.email}` : ""}</div>
        </div>
      ),
    },
    { key: "projects", header: "Projects", align: "center", sortValue: (r) => r.projects, render: (r) => <span>{r.projects}{r.activeProjects > 0 && <span className="ml-1 text-xs text-emerald-700">({r.activeProjects} active)</span>}</span> },
    { key: "contract", header: "Contract value", align: "right", sortValue: (r) => r.contract, render: (r) => formatMoney(r.contract) },
    { key: "received", header: "Received", align: "right", sortValue: (r) => r.received, render: (r) => <span className="text-emerald-700">{formatMoney(r.received)}</span> },
    { key: "due", header: "Balance due", align: "right", sortValue: (r) => r.due, render: (r) => <span className={r.due > 0 ? "font-semibold text-amber-700" : "text-slate-400"}>{formatMoney(r.due)}</span> },
    { key: "since", header: "Client since", sortValue: (r) => r.createdAt, render: (r) => <span className="whitespace-nowrap">{formatDate(r.createdAt)}</span> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      render: (r) => (
        <RowActions
          onEdit={() => setForm({ client: r })}
          onDelete={() => remove("clients", r.id)}
          disabledReason={r.projects > 0 ? "This client has projects, so it cannot be deleted." : undefined}
          deleteTitle={`Delete ${r.name}?`}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${rows.length} clients · ${formatMoney(sum(rows, (r) => r.due))} still to be received`}
        actions={canEdit && <Button onClick={() => setForm({})}><Plus className="size-4" /> Add client</Button>}
      />
      <Card>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/clients/${r.id}`)}
          searchText={(r) => `${r.name} ${r.phone} ${r.email ?? ""} ${r.cnic ?? ""} ${r.address ?? ""}`}
          searchPlaceholder="Search name, phone, email, CNIC…"
          initialSort={{ key: "name", dir: "asc" }}
          emptyTitle="No clients yet"
        />
      </Card>
      {form && <ClientForm client={form.client} onClose={() => setForm(null)} />}
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { contractBalance, deliveryValue, projectStock, supplierAccounts, sum, type StockRow } from "@/lib/calculations";
import {
  CONTRACTOR_PAYMENT_TYPE_LABELS, formatDate, formatMoney, formatQty, PAYMENT_METHOD_LABELS, STOCK_MOVEMENT_LABELS, SUPPLIER_PAYMENT_TYPE_LABELS,
} from "@/lib/format";
import type { ClientPayment, Contract, Delivery, Expense, PaymentMethod, Withdrawal } from "@/lib/types";
import { DataTable, FilterSelect, type Column } from "@/components/ui/DataTable";
import { ALL_TIME, DateRangeFilter, inRange, type DateRange } from "@/components/ui/DateRangeFilter";
import { Badge, ContractStatusBadge, ProgressBar } from "@/components/ui/Badge";
import { AttachmentChip } from "@/components/ui/FileDrop";
import { Modal } from "@/components/ui/Modal";
import { DetailList } from "@/components/ui/Card";
import { ClientPaymentForm } from "@/components/forms/clients";
import { ContractForm } from "@/components/forms/contractors";
import { ExpenseForm, WithdrawalForm } from "@/components/forms/finance";
import { RowActions } from "./RowActions";

const td = "tabular px-4 py-3 text-right";
const projectCol = <T extends { projectId: string }>(names: Map<string, string>): Column<T> => ({
  key: "project",
  header: "Project",
  sortValue: (r) => names.get(r.projectId) ?? "",
  render: (r) => <Link href={`/projects/${r.projectId}`} className="whitespace-nowrap text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>{names.get(r.projectId)}</Link>,
});
function useNames() {
  const { data } = useStore();
  return useMemo(() => ({
    project: new Map(data.projects.map((p) => [p.id, p.name])),
    client: new Map(data.clients.map((c) => [c.id, c.name])),
    contractor: new Map(data.contractors.map((c) => [c.id, c.name])),
    supplier: new Map(data.suppliers.map((s) => [s.id, s.name])),
    work: new Map(data.workCategories.map((w) => [w.id, w.name])),
    expenseCat: new Map(data.expenseCategories.map((c) => [c.id, c.name])),
    partner: new Map(data.partners.map((p) => [p.id, p.name])),
  }), [data]);
}

function MethodFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <FilterSelect label="Payment method" value={value} onChange={onChange}>
      <option value="">All methods</option>
      {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
    </FilterSelect>
  );
}

function ProjectFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useStore();
  return (
    <FilterSelect label="Project" value={value} onChange={onChange} className="max-w-56">
      <option value="">All projects</option>
      {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </FilterSelect>
  );
}

// ------------------------------------------------------------ client payments
export function ClientPaymentsTable({ projectId, clientId }: { projectId?: string; clientId?: string }) {
  const { data, remove } = useStore();
  const n = useNames();
  const [edit, setEdit] = useState<ClientPayment>();
  const [project, setProject] = useState("");
  const [method, setMethod] = useState("");
  const [range, setRange] = useState<DateRange>(ALL_TIME);
  const clientProjects = clientId ? new Set(data.projects.filter((p) => p.clientId === clientId).map((p) => p.id)) : undefined;
  const rows = data.clientPayments.filter(
    (r) => (!projectId || r.projectId === projectId) && (!clientProjects || clientProjects.has(r.projectId)) && (!project || r.projectId === project) && (!method || r.method === method) && inRange(r.date, range),
  );
  const columns: Column<ClientPayment>[] = [
    { key: "date", header: "Date", sortValue: (r) => r.date, render: (r) => <span className="whitespace-nowrap">{formatDate(r.date)}</span> },
    ...(projectId ? [] : [projectCol<ClientPayment>(n.project)]),
    ...(projectId || clientId ? [] : [{ key: "client", header: "Client", sortValue: (r: ClientPayment) => n.client.get(data.projects.find((p) => p.id === r.projectId)?.clientId ?? "") ?? "", render: (r: ClientPayment) => n.client.get(data.projects.find((p) => p.id === r.projectId)?.clientId ?? "") }]),
    { key: "method", header: "Method", sortValue: (r) => r.method, render: (r) => <div><div>{PAYMENT_METHOD_LABELS[r.method]}</div>{r.bankName && <div className="text-xs text-slate-500">{r.bankName}{r.reference ? ` · ${r.reference}` : ""}</div>}</div> },
    { key: "note", header: "Note", render: (r) => <span className="text-slate-600">{r.note ?? "—"}</span> },
    { key: "file", header: "Receipt", render: (r) => <AttachmentChip file={r.attachment} /> },
    { key: "amount", header: "Amount", align: "right", sortValue: (r) => r.amount, render: (r) => <span className="font-semibold text-emerald-700">{formatMoney(r.amount)}</span> },
    { key: "actions", header: <span className="sr-only">Actions</span>, render: (r) => <RowActions onEdit={() => setEdit(r)} onDelete={() => remove("clientPayments", r.id)} deleteTitle="Delete this payment?" deleteMessage={`${formatMoney(r.amount)} received on ${formatDate(r.date)} will be removed and the project's balance recalculated.`} /> },
  ];
  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchText={(r) => `${n.project.get(r.projectId)} ${r.bankName ?? ""} ${r.reference ?? ""} ${r.note ?? ""}`}
        searchPlaceholder="Search reference, bank, note…"
        initialSort={{ key: "date", dir: "desc" }}
        emptyTitle="No payments recorded"
        toolbar={<>{!projectId && <ProjectFilter value={project} onChange={setProject} />}<MethodFilter value={method} onChange={setMethod} /><DateRangeFilter value={range} onChange={setRange} /></>}
        footer={(rs) => (
          <tr>
            <td className="px-4 py-3" colSpan={columns.length - 2}>Total received ({rs.length})</td>
            <td className={td + " text-emerald-700"}>{formatMoney(sum(rs, (r) => r.amount))}</td>
            <td />
          </tr>
        )}
      />
      {edit && <ClientPaymentForm payment={edit} onClose={() => setEdit(undefined)} />}
    </>
  );
}

// ------------------------------------------------------------------ contracts
export function ContractsTable({ projectId, contractorId }: { projectId?: string; contractorId?: string }) {
  const { data, remove } = useStore();
  const router = useRouter();
  const n = useNames();
  const [edit, setEdit] = useState<Contract>();
  const [status, setStatus] = useState("");
  const rows = useMemo(
    () => data.contracts.filter((c) => (!projectId || c.projectId === projectId) && (!contractorId || c.contractorId === contractorId) && (!status || c.status === status)).map((c) => ({ ...c, b: contractBalance(data, c) })),
    [data, projectId, contractorId, status],
  );
  type R = (typeof rows)[number];
  const columns: Column<R>[] = [
    {
      key: "title",
      header: "Contract",
      sortValue: (r) => r.title,
      render: (r) => (
        <div className="min-w-52">
          <Link href={`/contractors/contracts/${r.id}`} className="font-medium text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>{n.work.get(r.workCategoryId)}</Link>
          <div className="text-xs text-slate-500">{contractorId ? n.project.get(r.projectId) : projectId ? n.contractor.get(r.contractorId) : `${n.contractor.get(r.contractorId)} · ${n.project.get(r.projectId)}`}</div>
        </div>
      ),
    },
    { key: "status", header: "Status", sortValue: (r) => r.status, render: (r) => <ContractStatusBadge status={r.status} /> },
    { key: "progress", header: "Work done", sortValue: (r) => r.progress, render: (r) => <ProgressBar value={r.progress} className="w-28" /> },
    { key: "amount", header: "Net payable", align: "right", sortValue: (r) => r.b.netPayable, render: (r) => <div>{formatMoney(r.b.netPayable)}{r.b.netPayable !== r.amount && <div className="text-xs text-slate-500">Agreed {formatMoney(r.amount)}</div>}</div> },
    { key: "paid", header: "Paid", align: "right", sortValue: (r) => r.b.paid, render: (r) => formatMoney(r.b.paid) },
    {
      key: "bal",
      header: "Balance",
      align: "right",
      sortValue: (r) => r.b.outstanding - r.b.overpaid,
      render: (r) => (r.b.overpaid > 0 ? <Badge tone="red">Overpaid {formatMoney(r.b.overpaid)}</Badge> : <span className={r.b.outstanding > 0 ? "font-semibold text-amber-700" : "text-emerald-700"}>{r.b.outstanding > 0 ? formatMoney(r.b.outstanding) : "Settled"}</span>),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      render: (r) => (
        <RowActions
          onEdit={() => setEdit(r)}
          onDelete={() => remove("contracts", r.id)}
          disabledReason={r.b.paid > 0 ? "This contract has payments, so it cannot be deleted. Mark it Terminated instead." : undefined}
          deleteTitle="Delete this contract?"
        />
      ),
    },
  ];
  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/contractors/contracts/${r.id}`)}
        searchText={(r) => `${r.title} ${n.contractor.get(r.contractorId)} ${n.project.get(r.projectId)}`}
        searchPlaceholder="Search contract, contractor, project…"
        initialSort={{ key: "status", dir: "asc" }}
        emptyTitle="No contracts yet"
        toolbar={
          <FilterSelect label="Status" value={status} onChange={setStatus}>
            <option value="">All statuses</option>
            <option value="ACTIVE">In progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="TERMINATED">Terminated</option>
          </FilterSelect>
        }
        footer={(rs) => (
          <tr>
            <td className="px-4 py-3" colSpan={3}>Total ({rs.length} contracts)</td>
            <td className={td}>{formatMoney(sum(rs, (r) => r.b.netPayable))}</td>
            <td className={td}>{formatMoney(sum(rs, (r) => r.b.paid))}</td>
            <td className={td + " text-amber-700"}>{formatMoney(sum(rs, (r) => r.b.outstanding))}</td>
            <td />
          </tr>
        )}
      />
      {edit && <ContractForm contract={edit} onClose={() => setEdit(undefined)} />}
    </>
  );
}

// -------------------------------------------------------- contractor payments
export function ContractorPaymentsTable({ contractId, contractorId, projectId }: { contractId?: string; contractorId?: string; projectId?: string }) {
  const { data, remove } = useStore();
  const n = useNames();
  const [range, setRange] = useState<DateRange>(ALL_TIME);
  const [type, setType] = useState("");
  const contracts = new Map(data.contracts.map((c) => [c.id, c]));
  const rows = data.contractorPayments
    .map((p) => ({ ...p, c: contracts.get(p.contractId)! }))
    .filter((p) => p.c && (!contractId || p.contractId === contractId) && (!contractorId || p.c.contractorId === contractorId) && (!projectId || p.c.projectId === projectId) && (!type || p.type === type) && inRange(p.date, range));
  type R = (typeof rows)[number];
  const columns: Column<R>[] = [
    { key: "date", header: "Date", sortValue: (r) => r.date, render: (r) => <span className="whitespace-nowrap">{formatDate(r.date)}</span> },
    ...(contractId ? [] : [{ key: "contract", header: contractorId ? "Contract" : "Contractor / work", sortValue: (r: R) => n.contractor.get(r.c.contractorId) ?? "", render: (r: R) => (
      <div>
        <Link href={`/contractors/contracts/${r.contractId}`} className="font-medium text-brand-700 hover:underline">{contractorId ? n.work.get(r.c.workCategoryId) : n.contractor.get(r.c.contractorId)}</Link>
        <div className="text-xs text-slate-500">{contractorId ? n.project.get(r.c.projectId) : `${n.work.get(r.c.workCategoryId)}${projectId ? "" : ` · ${n.project.get(r.c.projectId)}`}`}</div>
      </div>
    ) }]),
    { key: "type", header: "Type", sortValue: (r) => r.type, render: (r) => <Badge tone={r.type === "ADVANCE" ? "amber" : r.type === "FINAL" ? "green" : "blue"}>{CONTRACTOR_PAYMENT_TYPE_LABELS[r.type]}</Badge> },
    { key: "method", header: "Method", render: (r) => <div>{PAYMENT_METHOD_LABELS[r.method]}{r.reference && <div className="text-xs text-slate-500">{r.reference}</div>}</div> },
    { key: "note", header: "Note", render: (r) => <span className="text-slate-600">{r.note ?? "—"}</span> },
    { key: "amount", header: "Amount", align: "right", sortValue: (r) => r.amount, render: (r) => <span className="font-semibold">{formatMoney(r.amount)}</span> },
    { key: "actions", header: <span className="sr-only">Actions</span>, render: (r) => <RowActions onDelete={() => remove("contractorPayments", r.id)} deleteTitle="Delete this payment?" deleteMessage={`${formatMoney(r.amount)} paid on ${formatDate(r.date)} will be removed. The contractor's balance goes back up.`} /> },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      searchText={(r) => `${n.contractor.get(r.c.contractorId)} ${r.note ?? ""} ${r.reference ?? ""}`}
      initialSort={{ key: "date", dir: "desc" }}
      emptyTitle="No payments yet"
      toolbar={
        <>
          <FilterSelect label="Payment type" value={type} onChange={setType}>
            <option value="">All types</option>
            <option value="ADVANCE">Advance</option>
            <option value="INSTALLMENT">Installment</option>
            <option value="FINAL">Final payment</option>
          </FilterSelect>
          <DateRangeFilter value={range} onChange={setRange} />
        </>
      }
      footer={(rs) => (
        <tr>
          <td className="px-4 py-3" colSpan={columns.length - 2}>Total paid ({rs.length})</td>
          <td className={td}>{formatMoney(sum(rs, (r) => r.amount))}</td>
          <td />
        </tr>
      )}
    />
  );
}

// ----------------------------------------------------------- supplier tables
export function SupplierAccountsTable({ projectId, supplierId }: { projectId?: string; supplierId?: string }) {
  const { data } = useStore();
  const n = useNames();
  const rows = supplierAccounts(data, projectId, supplierId);
  type R = (typeof rows)[number];
  const columns: Column<R>[] = [
    supplierId
      ? projectCol<R>(n.project)
      : { key: "supplier", header: "Supplier", sortValue: (r) => n.supplier.get(r.supplierId) ?? "", render: (r) => <Link href={`/suppliers/${r.supplierId}`} className="font-medium text-brand-700 hover:underline">{n.supplier.get(r.supplierId)}</Link> },
    { key: "delivered", header: "Material received", align: "right", sortValue: (r) => r.delivered, render: (r) => formatMoney(r.delivered) },
    { key: "paid", header: "Paid", align: "right", sortValue: (r) => r.paid, render: (r) => formatMoney(r.paid) },
    { key: "adv", header: "Advance with supplier", align: "right", sortValue: (r) => -r.balance, render: (r) => (r.balance < 0 ? <span className="font-medium text-blue-700">{formatMoney(-r.balance)}</span> : <span className="text-slate-300">—</span>) },
    { key: "owed", header: "Outstanding", align: "right", sortValue: (r) => r.balance, render: (r) => (r.balance > 0 ? <span className="font-semibold text-amber-700">{formatMoney(r.balance)}</span> : <span className="text-emerald-700">{r.balance === 0 ? "Settled" : "—"}</span>) },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => `${r.projectId}-${r.supplierId}`}
      initialSort={{ key: "owed", dir: "desc" }}
      emptyTitle="No supplier activity"
      footer={(rs) => (
        <tr>
          <td className="px-4 py-3">Total</td>
          <td className={td}>{formatMoney(sum(rs, (r) => r.delivered))}</td>
          <td className={td}>{formatMoney(sum(rs, (r) => r.paid))}</td>
          <td className={td + " text-blue-700"}>{formatMoney(sum(rs, (r) => Math.max(-r.balance, 0)))}</td>
          <td className={td + " text-amber-700"}>{formatMoney(sum(rs, (r) => Math.max(r.balance, 0)))}</td>
        </tr>
      )}
    />
  );
}

export function DeliveriesTable({ projectId, supplierId }: { projectId?: string; supplierId?: string }) {
  const { data, remove } = useStore();
  const n = useNames();
  const [view, setView] = useState<Delivery>();
  const [range, setRange] = useState<DateRange>(ALL_TIME);
  const [project, setProject] = useState("");
  const rows = data.deliveries.filter((d) => (!projectId || d.projectId === projectId) && (!supplierId || d.supplierId === supplierId) && (!project || d.projectId === project) && inRange(d.date, range));
  const matName = (id: string) => data.materials.find((m) => m.id === id);
  const canDelete = (d: Delivery) => d.lines.every((l) => (projectStock(data, d.projectId).find((s) => s.materialId === l.materialId)?.onHand ?? 0) >= l.quantity);
  const columns: Column<Delivery>[] = [
    { key: "date", header: "Date", sortValue: (r) => r.date, render: (r) => <span className="whitespace-nowrap">{formatDate(r.date)}</span> },
    ...(projectId ? [] : [projectCol<Delivery>(n.project)]),
    ...(supplierId ? [] : [{ key: "supplier", header: "Supplier", sortValue: (r: Delivery) => n.supplier.get(r.supplierId) ?? "", render: (r: Delivery) => <Link href={`/suppliers/${r.supplierId}`} className="whitespace-nowrap text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>{n.supplier.get(r.supplierId)}</Link> }]),
    { key: "challan", header: "Challan", render: (r) => r.challanNo ?? "—" },
    {
      key: "items",
      header: "Items",
      render: (r) => (
        <div className="min-w-48 space-y-0.5 text-xs">
          {r.lines.map((l) => {
            const m = matName(l.materialId);
            return <div key={l.materialId}><span className="font-medium text-slate-800">{m?.name}</span> <span className="text-slate-500">{formatQty(l.quantity, m?.unit)} @ {formatMoney(l.rate)}</span></div>;
          })}
        </div>
      ),
    },
    { key: "value", header: "Value", align: "right", sortValue: (r) => deliveryValue(r), render: (r) => <span className="font-semibold">{formatMoney(deliveryValue(r))}</span> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      render: (r) => (
        <RowActions
          onDelete={() => remove("deliveries", r.id)}
          disabledReason={canDelete(r) ? undefined : "Some of this material has already been used, so the delivery cannot be deleted."}
          deleteTitle="Delete this delivery?"
          deleteMessage="The material will be removed from site stock and the supplier's bill reduced."
        />
      ),
    },
  ];
  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={setView}
        searchText={(r) => `${n.supplier.get(r.supplierId)} ${r.challanNo ?? ""} ${r.lines.map((l) => matName(l.materialId)?.name).join(" ")}`}
        searchPlaceholder="Search supplier, challan, material…"
        initialSort={{ key: "date", dir: "desc" }}
        emptyTitle="No material received yet"
        toolbar={<>{!projectId && <ProjectFilter value={project} onChange={setProject} />}<DateRangeFilter value={range} onChange={setRange} /></>}
        footer={(rs) => (
          <tr>
            <td className="px-4 py-3" colSpan={columns.length - 2}>Total received ({rs.length} deliveries)</td>
            <td className={td}>{formatMoney(sum(rs, deliveryValue))}</td>
            <td />
          </tr>
        )}
      />
      {view && (
        <Modal open onClose={() => setView(undefined)} title={`Delivery ${view.challanNo ?? ""}`} description={`${n.supplier.get(view.supplierId)} → ${n.project.get(view.projectId)}`} size="lg">
          <DetailList items={[["Date received", formatDate(view.date)], ["Challan / bill no.", view.challanNo ?? "—"], ["Note", view.note ?? "—"]]} />
          <table className="mt-4 w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
              <tr><th className="px-3 py-2">Material</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-right">Amount</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {view.lines.map((l) => {
                const m = matName(l.materialId);
                return (
                  <tr key={l.materialId}>
                    <td className="px-3 py-2">{m?.name}</td>
                    <td className="tabular px-3 py-2 text-right">{formatQty(l.quantity, m?.unit)}</td>
                    <td className="tabular px-3 py-2 text-right">{formatMoney(l.rate)}</td>
                    <td className="tabular px-3 py-2 text-right font-medium">{formatMoney(l.quantity * l.rate)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot><tr className="font-semibold"><td className="px-3 py-2" colSpan={3}>Total</td><td className="tabular px-3 py-2 text-right">{formatMoney(deliveryValue(view))}</td></tr></tfoot>
          </table>
        </Modal>
      )}
    </>
  );
}

export function SupplierPaymentsTable({ projectId, supplierId }: { projectId?: string; supplierId?: string }) {
  const { data, remove } = useStore();
  const n = useNames();
  const [type, setType] = useState("");
  const [range, setRange] = useState<DateRange>(ALL_TIME);
  const rows = data.supplierPayments.filter((p) => (!projectId || p.projectId === projectId) && (!supplierId || p.supplierId === supplierId) && (!type || p.type === type) && inRange(p.date, range));
  type R = (typeof rows)[number];
  const columns: Column<R>[] = [
    { key: "date", header: "Date", sortValue: (r) => r.date, render: (r) => <span className="whitespace-nowrap">{formatDate(r.date)}</span> },
    ...(projectId ? [] : [projectCol<R>(n.project)]),
    ...(supplierId ? [] : [{ key: "supplier", header: "Supplier", sortValue: (r: R) => n.supplier.get(r.supplierId) ?? "", render: (r: R) => <Link href={`/suppliers/${r.supplierId}`} className="whitespace-nowrap text-brand-700 hover:underline">{n.supplier.get(r.supplierId)}</Link> }]),
    { key: "type", header: "Type", sortValue: (r) => r.type, render: (r) => <Badge tone={r.type === "ADVANCE" ? "amber" : "blue"}>{SUPPLIER_PAYMENT_TYPE_LABELS[r.type]}</Badge> },
    { key: "method", header: "Method", render: (r) => <div>{PAYMENT_METHOD_LABELS[r.method]}{r.reference && <div className="text-xs text-slate-500">{r.reference}</div>}</div> },
    { key: "note", header: "Note", render: (r) => <span className="text-slate-600">{r.note ?? "—"}</span> },
    { key: "amount", header: "Amount", align: "right", sortValue: (r) => r.amount, render: (r) => <span className="font-semibold">{formatMoney(r.amount)}</span> },
    { key: "actions", header: <span className="sr-only">Actions</span>, render: (r) => <RowActions onDelete={() => remove("supplierPayments", r.id)} deleteTitle="Delete this payment?" deleteMessage={`${formatMoney(r.amount)} paid on ${formatDate(r.date)} will be removed. The supplier's balance goes back up.`} /> },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      searchText={(r) => `${n.supplier.get(r.supplierId)} ${r.reference ?? ""} ${r.note ?? ""}`}
      initialSort={{ key: "date", dir: "desc" }}
      emptyTitle="No payments yet"
      toolbar={
        <>
          <FilterSelect label="Payment type" value={type} onChange={setType}>
            <option value="">Advances & payments</option>
            <option value="ADVANCE">Advances only</option>
            <option value="PAYMENT">Payments only</option>
          </FilterSelect>
          <DateRangeFilter value={range} onChange={setRange} />
        </>
      }
      footer={(rs) => (
        <tr>
          <td className="px-4 py-3" colSpan={columns.length - 2}>Total paid ({rs.length})</td>
          <td className={td}>{formatMoney(sum(rs, (r) => r.amount))}</td>
          <td />
        </tr>
      )}
    />
  );
}

// ------------------------------------------------------------------ inventory
export function StockTable({ projectId, onAction }: { projectId?: string; onAction?: (r: StockRow, type: "CONSUMPTION" | "WASTAGE") => void }) {
  const { data, canEdit } = useStore();
  const n = useNames();
  const [cat, setCat] = useState("");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const rows = projectStock(data, projectId).filter((r) => {
    const m = data.materials.find((x) => x.id === r.materialId);
    return (!cat || m?.categoryId === cat) && (!onlyInStock || r.onHand > 0);
  });
  const mat = (id: string) => data.materials.find((m) => m.id === id);
  const columns: Column<StockRow>[] = [
    { key: "material", header: "Material", sortValue: (r) => mat(r.materialId)?.name ?? "", render: (r) => <div><div className="font-medium text-slate-900">{mat(r.materialId)?.name}</div><div className="text-xs text-slate-500">{data.materialCategories.find((c) => c.id === mat(r.materialId)?.categoryId)?.name}</div></div> },
    ...(projectId ? [] : [projectCol<StockRow>(n.project)]),
    { key: "received", header: "Received", align: "right", sortValue: (r) => r.received, render: (r) => formatQty(r.received, mat(r.materialId)?.unit) },
    { key: "consumed", header: "Consumed", align: "right", sortValue: (r) => r.consumed, render: (r) => formatQty(r.consumed, mat(r.materialId)?.unit) },
    { key: "wasted", header: "Wastage", align: "right", sortValue: (r) => r.wasted, render: (r) => (r.wasted ? <span className="text-red-700">{formatQty(r.wasted, mat(r.materialId)?.unit)}</span> : <span className="text-slate-300">—</span>) },
    {
      key: "onhand",
      header: "In stock",
      align: "right",
      sortValue: (r) => r.onHand,
      render: (r) => {
        const low = r.received > 0 && r.onHand / r.received < 0.1;
        return (
          <span className={r.onHand === 0 ? "text-slate-400" : low ? "font-semibold text-amber-700" : "font-semibold text-slate-900"}>
            {formatQty(r.onHand, mat(r.materialId)?.unit)}
            {low && r.onHand > 0 && <span className="ml-1.5 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800 uppercase">Low</span>}
          </span>
        );
      },
    },
    { key: "value", header: "Stock value", align: "right", sortValue: (r) => r.stockValue, render: (r) => <span title={`Average rate ${formatMoney(r.avgRate)}`}>{formatMoney(r.stockValue)}</span> },
    ...(canEdit && onAction
      ? [{
          key: "actions",
          header: <span className="sr-only">Actions</span>,
          render: (r: StockRow) =>
            r.onHand > 0 ? (
              <div className="flex justify-end gap-1 whitespace-nowrap">
                <button type="button" onClick={() => onAction(r, "CONSUMPTION")} className="rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">Use</button>
                <button type="button" onClick={() => onAction(r, "WASTAGE")} className="rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50">Wastage</button>
              </div>
            ) : null,
        }]
      : []),
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => `${r.projectId}-${r.materialId}`}
      searchText={(r) => `${mat(r.materialId)?.name} ${n.project.get(r.projectId)}`}
      searchPlaceholder="Search material…"
      initialSort={{ key: "value", dir: "desc" }}
      pageSize={25}
      emptyTitle="No stock at this site"
      emptyDescription="Stock appears here when material is received from a supplier."
      toolbar={
        <>
          <FilterSelect label="Category" value={cat} onChange={setCat}>
            <option value="">All categories</option>
            {data.materialCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </FilterSelect>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={onlyInStock} onChange={(e) => setOnlyInStock(e.target.checked)} className="size-4 accent-brand-700" /> Only in stock
          </label>
        </>
      }
      footer={(rs) => (
        <tr>
          <td className="px-4 py-3" colSpan={columns.length - (canEdit && onAction ? 2 : 1)}>Total stock value</td>
          <td className={td}>{formatMoney(sum(rs, (r) => r.stockValue))}</td>
          {canEdit && onAction && <td />}
        </tr>
      )}
    />
  );
}

type Movement = { id: string; date: string; projectId: string; materialId: string; type: "RECEIVED" | "CONSUMPTION" | "WASTAGE"; quantity: number; detail: string; source: "delivery" | "movement" };

export function MovementsTable({ projectId, materialId }: { projectId?: string; materialId?: string }) {
  const { data, remove } = useStore();
  const n = useNames();
  const [type, setType] = useState("");
  const [range, setRange] = useState<DateRange>(ALL_TIME);
  const rows = useMemo(() => {
    const out: Movement[] = [];
    for (const d of data.deliveries) {
      if (projectId && d.projectId !== projectId) continue;
      for (const l of d.lines) out.push({ id: `${d.id}-${l.materialId}`, date: d.date, projectId: d.projectId, materialId: l.materialId, type: "RECEIVED", quantity: l.quantity, detail: `${n.supplier.get(d.supplierId)}${d.challanNo ? ` · ${d.challanNo}` : ""}`, source: "delivery" });
    }
    for (const m of data.stockMovements) {
      if (projectId && m.projectId !== projectId) continue;
      out.push({ id: m.id, date: m.date, projectId: m.projectId, materialId: m.materialId, type: m.type, quantity: m.quantity, detail: [m.usedFor, m.note].filter(Boolean).join(" · ") || "—", source: "movement" });
    }
    return out.filter((r) => (!materialId || r.materialId === materialId) && (!type || r.type === type) && inRange(r.date, range));
  }, [data, projectId, materialId, type, range, n]);
  const mat = (id: string) => data.materials.find((m) => m.id === id);
  const columns: Column<Movement>[] = [
    { key: "date", header: "Date", sortValue: (r) => r.date, render: (r) => <span className="whitespace-nowrap">{formatDate(r.date)}</span> },
    ...(projectId ? [] : [projectCol<Movement>(n.project)]),
    { key: "material", header: "Material", sortValue: (r) => mat(r.materialId)?.name ?? "", render: (r) => <span className="font-medium text-slate-900">{mat(r.materialId)?.name}</span> },
    { key: "type", header: "Movement", sortValue: (r) => r.type, render: (r) => <Badge tone={r.type === "RECEIVED" ? "green" : r.type === "WASTAGE" ? "red" : "blue"}>{STOCK_MOVEMENT_LABELS[r.type]}</Badge> },
    { key: "detail", header: "Details", render: (r) => <span className="text-slate-600">{r.detail}</span> },
    { key: "qty", header: "Quantity", align: "right", sortValue: (r) => r.quantity, render: (r) => <span className={r.type === "RECEIVED" ? "font-medium text-emerald-700" : "font-medium"}>{r.type === "RECEIVED" ? "+" : "−"}{formatQty(r.quantity, mat(r.materialId)?.unit)}</span> },
    { key: "actions", header: <span className="sr-only">Actions</span>, render: (r) => (r.source === "movement" ? <RowActions onDelete={() => remove("stockMovements", r.id)} deleteTitle="Delete this stock entry?" deleteMessage="The quantity goes back into site stock." /> : null) },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      searchText={(r) => `${mat(r.materialId)?.name} ${r.detail}`}
      searchPlaceholder="Search material or details…"
      initialSort={{ key: "date", dir: "desc" }}
      emptyTitle="No stock movements"
      toolbar={
        <>
          <FilterSelect label="Movement type" value={type} onChange={setType}>
            <option value="">All movements</option>
            <option value="RECEIVED">Received</option>
            <option value="CONSUMPTION">Consumed</option>
            <option value="WASTAGE">Wastage</option>
          </FilterSelect>
          <DateRangeFilter value={range} onChange={setRange} />
        </>
      }
    />
  );
}

// -------------------------------------------------------------------- expenses
export function ExpensesTable({ projectId, misc }: { projectId?: string; misc?: "only" | "exclude" }) {
  const { data, remove } = useStore();
  const n = useNames();
  const [edit, setEdit] = useState<Expense>();
  const [project, setProject] = useState("");
  const [cat, setCat] = useState("");
  const [method, setMethod] = useState("");
  const [range, setRange] = useState<DateRange>(ALL_TIME);
  const isMisc = (id: string) => Boolean(data.expenseCategories.find((c) => c.id === id)?.isMiscellaneous);
  const cats = data.expenseCategories.filter((c) => (misc === "only" ? c.isMiscellaneous : misc === "exclude" ? !c.isMiscellaneous : true));
  const rows = data.expenses.filter(
    (e) => (!projectId || e.projectId === projectId) && (!project || e.projectId === project) && (!cat || e.categoryId === cat) && (!method || e.method === method) && inRange(e.date, range) && (misc === "only" ? isMisc(e.categoryId) : misc === "exclude" ? !isMisc(e.categoryId) : true),
  );
  const columns: Column<Expense>[] = [
    { key: "date", header: "Date", sortValue: (r) => r.date, render: (r) => <span className="whitespace-nowrap">{formatDate(r.date)}</span> },
    ...(projectId ? [] : [projectCol<Expense>(n.project)]),
    { key: "cat", header: "Category", sortValue: (r) => n.expenseCat.get(r.categoryId) ?? "", render: (r) => <Badge tone={isMisc(r.categoryId) ? "violet" : "slate"}>{n.expenseCat.get(r.categoryId)}</Badge> },
    { key: "desc", header: "Description", render: (r) => <div className="max-w-xs min-w-48"><div className="text-slate-900">{r.description}</div><div className="text-xs text-slate-500">Paid to {r.paidTo}</div></div> },
    { key: "method", header: "Method", sortValue: (r) => r.method, render: (r) => PAYMENT_METHOD_LABELS[r.method] },
    { key: "file", header: "Receipt", render: (r) => <AttachmentChip file={r.attachment} /> },
    { key: "amount", header: "Amount", align: "right", sortValue: (r) => r.amount, render: (r) => <span className="font-semibold">{formatMoney(r.amount)}</span> },
    { key: "actions", header: <span className="sr-only">Actions</span>, render: (r) => <RowActions onEdit={() => setEdit(r)} onDelete={() => remove("expenses", r.id)} deleteTitle="Delete this expense?" deleteMessage={`${formatMoney(r.amount)} — ${r.description}`} /> },
  ];
  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchText={(r) => `${r.description} ${r.paidTo} ${n.expenseCat.get(r.categoryId)} ${n.project.get(r.projectId)}`}
        searchPlaceholder="Search description, paid to…"
        initialSort={{ key: "date", dir: "desc" }}
        emptyTitle="No expenses found"
        toolbar={
          <>
            {!projectId && <ProjectFilter value={project} onChange={setProject} />}
            <FilterSelect label="Category" value={cat} onChange={setCat} className="max-w-56">
              <option value="">All categories</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FilterSelect>
            <MethodFilter value={method} onChange={setMethod} />
            <DateRangeFilter value={range} onChange={setRange} />
          </>
        }
        footer={(rs) => (
          <tr>
            <td className="px-4 py-3" colSpan={columns.length - 2}>Total ({rs.length} expenses)</td>
            <td className={td}>{formatMoney(sum(rs, (r) => r.amount))}</td>
            <td />
          </tr>
        )}
      />
      {edit && <ExpenseForm expense={edit} onClose={() => setEdit(undefined)} />}
    </>
  );
}

// ----------------------------------------------------------------- withdrawals
export function WithdrawalsTable({ projectId, partnerId }: { projectId?: string; partnerId?: string }) {
  const { data, remove } = useStore();
  const n = useNames();
  const [edit, setEdit] = useState<Withdrawal>();
  const [partner, setPartner] = useState("");
  const [project, setProject] = useState("");
  const [range, setRange] = useState<DateRange>(ALL_TIME);
  const rows = data.withdrawals.filter((w) => (!projectId || w.projectId === projectId) && (!partnerId || w.partnerId === partnerId) && (!partner || w.partnerId === partner) && (!project || w.projectId === project) && inRange(w.date, range));
  const columns: Column<Withdrawal>[] = [
    { key: "date", header: "Date", sortValue: (r) => r.date, render: (r) => <span className="whitespace-nowrap">{formatDate(r.date)}</span> },
    ...(partnerId ? [] : [{ key: "partner", header: "Partner", sortValue: (r: Withdrawal) => n.partner.get(r.partnerId) ?? "", render: (r: Withdrawal) => <span className="font-medium text-slate-900">{n.partner.get(r.partnerId)}</span> }]),
    ...(projectId ? [] : [projectCol<Withdrawal>(n.project)]),
    { key: "method", header: "Method", sortValue: (r) => r.method, render: (r) => PAYMENT_METHOD_LABELS[r.method] },
    { key: "note", header: "Note", render: (r) => <span className="text-slate-600">{r.note ?? "—"}</span> },
    { key: "amount", header: "Amount", align: "right", sortValue: (r) => r.amount, render: (r) => <span className="font-semibold">{formatMoney(r.amount)}</span> },
    { key: "actions", header: <span className="sr-only">Actions</span>, render: (r) => <RowActions onEdit={() => setEdit(r)} onDelete={() => remove("withdrawals", r.id)} deleteTitle="Delete this withdrawal?" deleteMessage={`${formatMoney(r.amount)} by ${n.partner.get(r.partnerId)} on ${formatDate(r.date)}.`} /> },
  ];
  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchText={(r) => `${n.partner.get(r.partnerId)} ${n.project.get(r.projectId)} ${r.note ?? ""}`}
        initialSort={{ key: "date", dir: "desc" }}
        emptyTitle="No withdrawals"
        toolbar={
          <>
            {!partnerId && (
              <FilterSelect label="Partner" value={partner} onChange={setPartner}>
                <option value="">All partners</option>
                {data.partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </FilterSelect>
            )}
            {!projectId && <ProjectFilter value={project} onChange={setProject} />}
            <DateRangeFilter value={range} onChange={setRange} />
          </>
        }
        footer={(rs) => (
          <tr>
            <td className="px-4 py-3" colSpan={columns.length - 2}>Total withdrawn ({rs.length})</td>
            <td className={td}>{formatMoney(sum(rs, (r) => r.amount))}</td>
            <td />
          </tr>
        )}
      />
      {edit && <WithdrawalForm withdrawal={edit} onClose={() => setEdit(undefined)} />}
    </>
  );
}

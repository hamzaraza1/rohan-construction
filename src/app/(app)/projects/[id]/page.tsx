import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes, Pencil, Plus } from "lucide-react";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/guards";
import { dbRead } from "@/lib/db";
import { getFinancialSummary, getProject, getProjectLedger, getStockSummary, listClientPayments, type FinancialSummary } from "@/lib/queries/projects";
import { setProjectArchived } from "@/lib/actions/projects";
import { formatDate, formatMoney, LEDGER_SOURCE_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/format";
import { optionalDateInput, toDateInput } from "@/lib/validation";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { LinkTabs } from "@/components/ui/Tabs";
import { ProjectStatusBadge, ProjectTypeBadge } from "@/components/domain/badges";
import { ArchiveButton } from "@/components/domain/ArchiveButton";
import { ClientPaymentsTable } from "@/components/domain/ClientPaymentsTable";
import { ContractsTable } from "@/components/domain/ContractsTable";
import { listContractsForProject } from "@/lib/queries/contractors";
import { listPurchaseOrders, listReceipts, listSupplierPayments, supplierAccounts, sumAccounts } from "@/lib/queries/suppliers";
import { getProjectStock, listStockMovements } from "@/lib/queries/inventory";
import { createStockMovement, voidStockMovement } from "@/lib/actions/inventory";
import { PurchaseOrdersTable, ReceiptsTable, SupplierAccountsTable, SupplierPaymentsTable } from "@/components/domain/SupplyTables";
import { StockMovementForm } from "@/components/domain/StockMovementForm";
import { VoidDialog } from "@/components/domain/VoidDialog";
import { formatNumber } from "@/lib/format";
import { todayPk } from "@/lib/validation";
import { Truck, FileText } from "lucide-react";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const project = await getProject((await params).id);
  return { title: project?.name ?? "Project" };
}

export default async function ProjectPage({ params, searchParams }: Params) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const { id } = await params;
  const sp = await searchParams;
  const TABS = ["payments", "contracts", "suppliers", "inventory", "ledger"] as const;
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as (typeof TABS)[number]) : "overview";

  const [project, summary, paymentCount] = await Promise.all([
    getProject(id),
    getFinancialSummary(id),
    dbRead.clientPayment.count({ where: { projectId: id, voidedAt: null } }),
  ]);
  if (!project || !summary) notFound();

  const base = `/projects/${id}`;
  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            <Link href="/projects" className="hover:underline">Projects</Link> /
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{project.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <ProjectTypeBadge type={project.type} commission={project.commissionPercent} />
            <ProjectStatusBadge status={project.status} />
            {project.archivedAt && <Badge tone="red">Archived</Badge>}
            <span>
              Client: <Link href={`/clients/${project.client.id}`} className="font-medium text-brand-700 hover:underline">{project.client.name}</Link>
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {project.siteAddress} · Started {formatDate(project.startDate)}
            {project.expectedCompletionDate && ` · Expected completion ${formatDate(project.expectedCompletionDate)}`}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            {!project.archivedAt && (
              <ButtonLink href={`${base}/payments/new`}><Plus className="size-4" /> Record client payment</ButtonLink>
            )}
            <ButtonLink href={`${base}/edit`} variant="secondary"><Pencil className="size-4" /> Edit</ButtonLink>
            <ArchiveButton action={setProjectArchived.bind(null, id, !project.archivedAt)} archived={Boolean(project.archivedAt)} what="project" />
          </div>
        )}
      </div>

      <LinkTabs
        active={tab}
        tabs={[
          { key: "overview", label: "Dashboard", href: base },
          { key: "payments", label: "Client payments", href: `${base}?tab=payments`, count: paymentCount },
          { key: "contracts", label: "Contractors", href: `${base}?tab=contracts` },
          { key: "suppliers", label: "Suppliers", href: `${base}?tab=suppliers` },
          { key: "inventory", label: "Inventory", href: `${base}?tab=inventory` },
          { key: "ledger", label: "Cash ledger", href: `${base}?tab=ledger` },
        ]}
      />
      <div className="mt-6">
        {tab === "overview" && <Overview projectId={id} summary={summary} description={project.description} />}
        {tab === "payments" && <Payments projectId={id} isAdmin={isAdmin} archived={Boolean(project.archivedAt)} />}
        {tab === "contracts" && <Contracts projectId={id} isAdmin={isAdmin} archived={Boolean(project.archivedAt)} />}
        {tab === "suppliers" && <Suppliers projectId={id} isAdmin={isAdmin} archived={Boolean(project.archivedAt)} />}
        {tab === "inventory" && <Inventory projectId={id} isAdmin={isAdmin} archived={Boolean(project.archivedAt)} />}
        {tab === "ledger" && <Ledger projectId={id} from={sp.from} to={sp.to} />}
      </div>
    </>
  );
}

// -----------------------------------------------------------------------------

async function Overview({ projectId, summary: s, description }: { projectId: string; summary: FinancialSummary; description: string | null }) {
  const [stock, ledger] = await Promise.all([getStockSummary(projectId), getProjectLedger(projectId)]);
  const recent = ledger.entries.slice(-8).reverse();
  const outflows = [
    { label: "Supplier payments", value: s.supplierPayments },
    { label: "Contractor payments", value: s.contractorPayments },
    { label: "Expenses", value: s.directExpenses },
    { label: "Partner withdrawals", value: s.partnerWithdrawals },
  ];
  const maxOut = Prisma.Decimal.max(1, ...outflows.map((o) => o.value));
  const isCommission = s.type === "COMMISSION";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Client payments received" value={formatMoney(s.clientReceipts)} />
        <StatCard
          label="Total actual expenses"
          value={formatMoney(s.projectCost)}
          hint="Materials received + contractor payments + expenses"
        />
        <StatCard label="Partner withdrawals" value={formatMoney(s.partnerWithdrawals)} hint="Drawings — not an expense" />
        <StatCard
          label="Available cash balance"
          value={formatMoney(s.cashBalance)}
          tone={s.cashBalance.isNegative() ? "negative" : "positive"}
          hint="Receipts − all cash paid out − withdrawals"
        />
        <StatCard label="Contractor payments" value={formatMoney(s.contractorPayments)} />
        <StatCard label="Supplier payments" value={formatMoney(s.supplierPayments)} hint={s.supplierAdvances.isZero() ? undefined : `Includes ${formatMoney(s.supplierAdvances)} unused advance`} />
        <StatCard
          label="Outstanding to suppliers"
          value={formatMoney(s.supplierOutstanding)}
          tone={s.supplierOutstanding.isZero() ? "default" : "warning"}
          hint={s.undeliveredOrders.isZero() ? "Material received, not yet paid" : `Plus ${formatMoney(s.undeliveredOrders)} still to be delivered`}
        />
        <StatCard
          label="Outstanding to contractors"
          value={formatMoney(s.contractorOutstanding)}
          tone={s.contractorOutstanding.isZero() ? "default" : "warning"}
          hint={`Of ${formatMoney(s.contractCommitted)} contracted`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={isCommission ? "Commission and client billing" : "Client account"}
            description={isCommission ? "Commission is charged on the actual project cost." : "Agreed value versus payments received."}
          />
          <dl className="divide-y divide-slate-100 text-sm">
            {isCommission ? (
              <>
                <Row label="Materials received (valued at purchase rate)" value={s.materialReceivedValue} />
                <Row label="Contractor payments" value={s.contractorPayments} />
                <Row label="Other expenses" value={s.directExpenses} />
                <Row label="Total actual project cost" value={s.projectCost} strong />
                <Row label={`Commission @ ${s.commissionPercent?.toString()}%`} value={s.commissionAmount} />
                <Row label="Billable to client (cost + commission)" value={s.clientBillable} strong />
                <Row label="Received from client" value={s.clientReceipts} />
                <DueRow due={s.clientAmountDue} />
              </>
            ) : s.clientContractAmount ? (
              <>
                <Row label="Agreed contract value" value={s.clientContractAmount} strong />
                <Row label="Received from client" value={s.clientReceipts} />
                <DueRow due={s.clientAmountDue} />
              </>
            ) : (
              <div className="px-5 py-4 text-slate-600">
                Received from client: <span className="font-semibold text-slate-900">{formatMoney(s.clientReceipts)}</span>.
                {" "}No agreed contract value is entered for this project, so the remaining amount cannot be calculated. Add it under Edit if you want it tracked.
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Cash paid out" description="Where this project's money went" />
          <ul className="space-y-3 p-5">
            {outflows.map((o) => (
              <li key={o.label}>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{o.label}</span>
                  <span className="tabular font-medium">{formatMoney(o.value)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-brand-500" style={{ width: `${o.value.div(maxOut).mul(100).toFixed(1)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Recent transactions" description="Latest cash movements on this project" />
          {recent.length === 0 ? (
            <EmptyState title="No transactions yet" />
          ) : (
            <LedgerTable entries={recent} />
          )}
        </Card>
        <Card>
          <CardHeader title="Inventory" description="Site stock" />
          <div className="p-5">
            {stock.receivedValue.isZero() ? (
              <div className="flex items-start gap-3 text-sm text-slate-600">
                <Boxes className="size-5 shrink-0 text-slate-400" />
                No material received on this site yet. Material is received from the Suppliers tab.
              </div>
            ) : (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-slate-600">Materials in stock</dt><dd className="font-medium">{stock.materials}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-600">Stock value</dt><dd className="tabular font-medium">{formatMoney(stock.stockValue)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-600">Total received</dt><dd className="tabular font-medium">{formatMoney(stock.receivedValue)}</dd></div>
              </dl>
            )}
          </div>
          <div className="border-t border-slate-100 px-5 py-3 text-sm">
            <Link href={`/projects/${projectId}?tab=inventory`} className="font-medium text-brand-700 hover:underline">View site stock →</Link>
          </div>
          {description && (
            <div className="border-t border-slate-100 p-5">
              <h3 className="text-sm font-semibold text-slate-900">Project description</h3>
              <p className="mt-1 text-sm whitespace-pre-line text-slate-600">{description}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: Prisma.Decimal | null; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 px-5 py-3">
      <dt className={strong ? "font-medium text-slate-900" : "text-slate-600"}>{label}</dt>
      <dd className={`tabular ${strong ? "font-semibold text-slate-900" : "text-slate-700"}`}>{formatMoney(value)}</dd>
    </div>
  );
}

function DueRow({ due }: { due: Prisma.Decimal | null }) {
  if (!due) return null;
  const ahead = due.isNegative();
  return (
    <div className="flex justify-between gap-4 bg-slate-50 px-5 py-3">
      <dt className="font-semibold text-slate-900">{ahead ? "Client has paid in advance" : "Client still has to pay"}</dt>
      <dd className={`tabular font-semibold ${ahead ? "text-emerald-700" : due.isZero() ? "text-slate-900" : "text-amber-700"}`}>
        {formatMoney(due.abs())}
      </dd>
    </div>
  );
}

// -----------------------------------------------------------------------------

async function Payments({ projectId, isAdmin, archived }: { projectId: string; isAdmin: boolean; archived: boolean }) {
  const payments = await listClientPayments({ projectId }, 1000);
  const total = payments.filter((p) => !p.voidedAt).reduce((a, p) => a.plus(p.amount), new Prisma.Decimal(0));
  return (
    <Card>
      <CardHeader
        title="Client payments"
        description={`${payments.filter((p) => !p.voidedAt).length} payment(s) · total ${formatMoney(total)}`}
        actions={
          isAdmin && !archived ? (
            <ButtonLink href={`/projects/${projectId}/payments/new`} size="sm"><Plus className="size-4" /> Record payment</ButtonLink>
          ) : undefined
        }
      />
      {payments.length === 0 ? (
        <EmptyState title="No client payments recorded" description="Each payment received from the client is entered here manually." />
      ) : (
        <ClientPaymentsTable payments={payments} isAdmin={isAdmin} />
      )}
    </Card>
  );
}

// -----------------------------------------------------------------------------

async function Contracts({ projectId, isAdmin, archived }: { projectId: string; isAdmin: boolean; archived: boolean }) {
  const { contracts, balances, totals } = await listContractsForProject(projectId);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total contract commitments" value={formatMoney(totals.netPayable)} hint="Incl. extras and deductions — not cash" />
        <StatCard label="Paid to contractors" value={formatMoney(totals.paid)} />
        <StatCard label="Remaining payable" value={formatMoney(totals.outstanding)} tone={totals.outstanding.isZero() ? "default" : "warning"} />
      </div>
      <Card>
        <CardHeader
          title="Contractor contracts"
          description="Each contract records its agreed amount, work scope, extras/deductions and payments."
          actions={
            isAdmin && !archived ? (
              <ButtonLink href={`/contracts/new?projectId=${projectId}`} size="sm"><Plus className="size-4" /> New contract</ButtonLink>
            ) : undefined
          }
        />
        {contracts.length === 0 ? (
          <EmptyState title="No contractor contracts on this project" />
        ) : (
          <ContractsTable contracts={contracts} balances={balances} show="contractor" />
        )}
      </Card>
    </div>
  );
}

// -----------------------------------------------------------------------------

async function Suppliers({ projectId, isAdmin, archived }: { projectId: string; isAdmin: boolean; archived: boolean }) {
  const [accounts, orders, receipts, payments] = await Promise.all([
    supplierAccounts({ projectId }),
    listPurchaseOrders({ projectId }),
    listReceipts({ projectId }),
    listSupplierPayments({ projectId }),
  ]);
  const names = new Map([...orders.map((o) => [o.supplierId, o.supplier.name] as const), ...receipts.map((r) => [r.supplierId, r.supplier.name] as const), ...payments.map((p) => [p.supplierId, p.supplier.name] as const)]);
  const t = sumAccounts(accounts);
  const canWrite = isAdmin && !archived;
  return (
    <div className="space-y-6">
      {canWrite && (
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/purchase-orders/new?projectId=${projectId}`} variant="secondary"><FileText className="size-4" /> New purchase order</ButtonLink>
          <ButtonLink href={`/receipts/new?projectId=${projectId}`} variant="secondary"><Truck className="size-4" /> Receive material (no order)</ButtonLink>
          <ButtonLink href={`/supplier-payments/new?projectId=${projectId}`} variant="secondary"><Plus className="size-4" /> Pay supplier / advance</ButtonLink>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total orders" value={formatMoney(t.orderedValue)} hint="Commitments (not cash)" />
        <StatCard label="Material received" value={formatMoney(t.receivedValue)} hint="Project cost" />
        <StatCard label="Paid to suppliers" value={formatMoney(t.paid)} hint="Cash out (advances + payments)" />
        <StatCard label="Advance balance" value={formatMoney(t.advanceBalance)} hint="Paid, material not yet received" />
        <StatCard label="Outstanding payable" value={formatMoney(t.outstandingPayable)} tone={t.outstandingPayable.isZero() ? "default" : "warning"} hint="Received, not yet paid" />
        <StatCard label="Undelivered orders" value={formatMoney(t.undeliveredValue)} />
      </div>
      <Card>
        <CardHeader title="Supplier accounts" description="Balances are calculated per supplier for this project only." />
        {accounts.length === 0 ? (
          <EmptyState title="No supplier transactions on this project yet" />
        ) : (
          <SupplierAccountsTable
            label="Supplier"
            rows={accounts.map((a) => ({ ...a, key: a.supplierId, name: names.get(a.supplierId) ?? "Supplier", href: `/suppliers/${a.supplierId}` }))}
          />
        )}
      </Card>
      {orders.length > 0 && (
        <Card>
          <CardHeader title="Purchase orders" />
          <PurchaseOrdersTable orders={orders} show="supplier" />
        </Card>
      )}
      {receipts.length > 0 && (
        <Card>
          <CardHeader title="Material received" />
          <ReceiptsTable receipts={receipts} show="supplier" />
        </Card>
      )}
      {payments.length > 0 && (
        <Card>
          <CardHeader title="Supplier payments" />
          <SupplierPaymentsTable payments={payments} isAdmin={canWrite} show="supplier" />
        </Card>
      )}
    </div>
  );
}

async function Inventory({ projectId, isAdmin, archived }: { projectId: string; isAdmin: boolean; archived: boolean }) {
  const [stock, movements] = await Promise.all([getProjectStock(projectId), listStockMovements(projectId)]);
  const value = stock.reduce((a, s) => a.plus(s.stockValue), new Prisma.Decimal(0));
  const canWrite = isAdmin && !archived;
  const MOVE = { ISSUE: "Issued", WASTAGE: "Wastage", ADJUSTMENT: "Correction" } as const;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Site stock"
          description={`Stock value ${formatMoney(value)} (remaining quantity × average received rate). Stock comes in only through material receipts.`}
        />
        {stock.length === 0 ? (
          <EmptyState title="No materials ordered or received on this site yet" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Material</TH>
                <TH numeric>Purchased (ordered)</TH>
                <TH numeric>Received</TH>
                <TH numeric>Issued / used</TH>
                <TH numeric>Wastage</TH>
                <TH numeric>Corrections</TH>
                <TH numeric>In stock</TH>
                <TH numeric>Avg rate</TH>
                <TH numeric>Stock value</TH>
              </tr>
            </THead>
            <TBody>
              {stock.map((s) => (
                <TR key={s.materialId}>
                  <TD><div className="font-medium">{s.materialName}</div><div className="text-xs text-slate-500">{s.categoryName}</div></TD>
                  <TD numeric>{formatNumber(s.orderedQty)}</TD>
                  <TD numeric>{formatNumber(s.receivedQty)}</TD>
                  <TD numeric>{formatNumber(s.issuedQty)}</TD>
                  <TD numeric>{formatNumber(s.wastedQty)}</TD>
                  <TD numeric>{s.adjustedQty.isZero() ? "—" : formatNumber(s.adjustedQty)}</TD>
                  <TD numeric className="font-semibold">{formatNumber(s.onHandQty)} {s.unit}</TD>
                  <TD numeric>{formatMoney(s.avgRate)}</TD>
                  <TD numeric>{formatMoney(s.stockValue)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      {canWrite && stock.some((s) => s.receivedQty.greaterThan(0)) && (
        <Card>
          <CardHeader title="Record stock usage" description="Issue to work, wastage, or a correction after a physical count. Stock can never go below zero." />
          <StockMovementForm
            action={createStockMovement.bind(null, projectId)}
            today={todayPk()}
            materials={stock.filter((s) => s.receivedQty.greaterThan(0)).map((s) => ({ id: s.materialId, name: s.materialName, unit: s.unit, onHand: formatNumber(s.onHandQty) }))}
          />
        </Card>
      )}
      {movements.length > 0 && (
        <Card>
          <CardHeader title="Stock usage history" />
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Entry</TH>
                <TH>Material</TH>
                <TH numeric>Quantity</TH>
                <TH>Notes</TH>
                <TH className="w-px"><span className="sr-only">Actions</span></TH>
              </tr>
            </THead>
            <TBody>
              {movements.map((m) => {
                const v = Boolean(m.voidedAt);
                return (
                  <TR key={m.id} className={v ? "text-slate-400" : undefined}>
                    <TD className={v ? "text-slate-400" : undefined}>{formatDate(m.date)}</TD>
                    <TD>{v ? <Badge tone="red">Voided</Badge> : <Badge tone={m.type === "WASTAGE" ? "amber" : m.type === "ADJUSTMENT" ? "violet" : "slate"}>{MOVE[m.type]}</Badge>}</TD>
                    <TD className={v ? "text-slate-400" : undefined}>{m.material.name}</TD>
                    <TD numeric className={v ? "line-through" : undefined}>
                      {m.type === "ADJUSTMENT" && m.quantity.greaterThan(0) ? "+" : m.type === "ADJUSTMENT" ? "" : "−"}{formatNumber(m.quantity)} {m.material.unit}
                    </TD>
                    <TD className="max-w-xs whitespace-normal text-slate-500">{v ? m.voidReason : m.notes}</TD>
                    <TD>
                      {canWrite && !v && (
                        <VoidDialog
                          action={voidStockMovement.bind(null, m.id)}
                          title="Void this stock entry?"
                          description="The quantity goes back into (or out of) stock. Not allowed if that would make stock negative."
                        />
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------

async function Ledger({ projectId, from, to }: { projectId: string; from?: string; to?: string }) {
  const fromD = optionalDateInput().safeParse(from || undefined).data ?? null;
  const toD = optionalDateInput().safeParse(to || undefined).data ?? null;
  const { entries, opening } = await getProjectLedger(projectId, fromD, toD);
  const totalIn = entries.reduce((a, e) => a.plus(e.inflow), new Prisma.Decimal(0));
  const totalOut = entries.reduce((a, e) => a.plus(e.outflow), new Prisma.Decimal(0));
  return (
    <Card>
      <CardHeader
        title="Cash ledger"
        description="Every actual money movement for this project, with running balance. Orders and contract amounts are commitments and do not appear here."
        actions={
          <form className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="tab" value="ledger" />
            <label className="text-xs text-slate-500">From<Input type="date" name="from" defaultValue={toDateInput(fromD)} className="mt-0.5 w-40" /></label>
            <label className="text-xs text-slate-500">To<Input type="date" name="to" defaultValue={toDateInput(toD)} className="mt-0.5 w-40" /></label>
            <Button type="submit" variant="secondary">Apply</Button>
          </form>
        }
      />
      {entries.length === 0 && opening.isZero() ? (
        <EmptyState title="No cash movements in this period" />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Date</TH>
              <TH>Type</TH>
              <TH>Party</TH>
              <TH>Method</TH>
              <TH>Details</TH>
              <TH numeric>In</TH>
              <TH numeric>Out</TH>
              <TH numeric>Balance</TH>
            </tr>
          </THead>
          <TBody>
            {fromD && (
              <TR>
                <TD colSpan={7} className="font-medium">Opening balance on {formatDate(fromD)}</TD>
                <TD numeric className="font-semibold">{formatMoney(opening)}</TD>
              </TR>
            )}
            {entries.map((e) => (
              <TR key={`${e.sourceType}-${e.sourceId}`}>
                <TD className="whitespace-nowrap">{formatDate(e.date)}</TD>
                <TD>{LEDGER_SOURCE_LABELS[e.sourceType] ?? e.sourceType}</TD>
                <TD>{e.counterparty ?? "—"}</TD>
                <TD>{PAYMENT_METHOD_LABELS[e.method as keyof typeof PAYMENT_METHOD_LABELS] ?? e.method}</TD>
                <TD className="max-w-xs truncate text-slate-500" title={e.description ?? undefined}>
                  {[e.reference, e.description].filter(Boolean).join(" · ")}
                </TD>
                <TD numeric className="text-emerald-700">{e.inflow.isZero() ? "" : formatMoney(e.inflow)}</TD>
                <TD numeric>{e.outflow.isZero() ? "" : formatMoney(e.outflow)}</TD>
                <TD numeric className={e.balance.isNegative() ? "font-medium text-red-700" : "font-medium"}>{formatMoney(e.balance)}</TD>
              </TR>
            ))}
            <TR className="bg-slate-50 font-semibold">
              <TD colSpan={5}>Totals for period</TD>
              <TD numeric className="text-emerald-700">{formatMoney(totalIn)}</TD>
              <TD numeric>{formatMoney(totalOut)}</TD>
              <TD numeric>{formatMoney(opening.plus(totalIn).minus(totalOut))}</TD>
            </TR>
          </TBody>
        </Table>
      )}
    </Card>
  );
}

function LedgerTable({ entries }: { entries: Awaited<ReturnType<typeof getProjectLedger>>["entries"] }) {
  return (
    <Table>
      <THead>
        <tr>
          <TH>Date</TH>
          <TH>Type</TH>
          <TH>Party</TH>
          <TH numeric>In</TH>
          <TH numeric>Out</TH>
        </tr>
      </THead>
      <TBody>
        {entries.map((e) => (
          <TR key={`${e.sourceType}-${e.sourceId}`}>
            <TD>{formatDate(e.date)}</TD>
            <TD>{LEDGER_SOURCE_LABELS[e.sourceType] ?? e.sourceType}</TD>
            <TD>{e.counterparty ?? "—"}</TD>
            <TD numeric className="text-emerald-700">{e.inflow.isZero() ? "" : formatMoney(e.inflow)}</TD>
            <TD numeric>{e.outflow.isZero() ? "" : formatMoney(e.outflow)}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

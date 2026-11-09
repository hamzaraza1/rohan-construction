import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Pencil, Plus, X } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getContract } from "@/lib/queries/contractors";
import { createAdjustment, updateContractProgress, voidAdjustment, voidContract } from "@/lib/actions/contracts";
import { formatDate, formatMoney } from "@/lib/format";
import { todayPk } from "@/lib/validation";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { ActionForm } from "@/components/ui/ActionForm";
import { FormField } from "@/components/ui/FormField";
import { Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { VoidDialog } from "@/components/domain/VoidDialog";
import { ContractStatusBadge, ProgressBar } from "@/components/domain/ContractsTable";
import { ContractorPaymentsTable } from "@/components/domain/ContractorPaymentsTable";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const k = await getContract((await params).id);
  return { title: k?.title ?? "Contract" };
}

export default async function ContractPage({ params }: Params) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const { id } = await params;
  const k = await getContract(id);
  if (!k) notFound();
  const voided = Boolean(k.voidedAt);
  const b = k.balance;
  const included = k.scopeItems.filter((s) => s.included);
  const excluded = k.scopeItems.filter((s) => !s.included);
  const activePayments = k.payments.filter((p) => !p.voidedAt).length;
  const activeAdjustments = k.adjustments.filter((a) => !a.voidedAt).length;
  const canWrite = isAdmin && !voided && !k.project.archivedAt;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            <Link href={`/projects/${k.project.id}?tab=contracts`} className="hover:underline">{k.project.name}</Link> / Contracts /
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{k.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            {voided ? <Badge tone="red">Voided</Badge> : <ContractStatusBadge status={k.status} />}
            {!voided && <ProgressBar value={k.progressPercent} />}
            <span>
              Contractor: <Link href={`/contractors/${k.contractor.id}`} className="font-medium text-brand-700 hover:underline">{k.contractor.name}</Link>
            </span>
            <span>
              {formatDate(k.startDate)}
              {k.endDate && ` → ${formatDate(k.endDate)}`}
            </span>
          </div>
          {voided && <p className="mt-2 text-sm text-red-700">Voided: {k.voidReason}</p>}
        </div>
        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href={`/contracts/${id}/payments/new`}><Plus className="size-4" /> Pay contractor</ButtonLink>
            <ButtonLink href={`/contracts/${id}/edit`} variant="secondary"><Pencil className="size-4" /> Edit</ButtonLink>
            {activePayments === 0 && activeAdjustments === 0 && (
              <VoidDialog
                action={voidContract.bind(null, id)}
                title="Void this contract?"
                description="Use this only for a contract entered by mistake. It will no longer count as a commitment. Contracts with payments cannot be voided."
              />
            )}
          </div>
        )}
      </div>

      {b && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Agreed contract amount" value={formatMoney(b.contractAmount)} hint="Commitment, not a cash outflow" />
          <StatCard
            label="Net payable"
            value={formatMoney(b.netPayable)}
            hint={`+ ${formatMoney(b.extras)} extras − ${formatMoney(b.deductions)} deductions`}
          />
          <StatCard label="Total paid" value={formatMoney(b.paid)} hint={`${activePayments} payment(s)`} />
          {b.overpaid.greaterThan(0) ? (
            <StatCard label="Overpaid" value={formatMoney(b.overpaid)} tone="warning" hint="Paid more than the net payable" />
          ) : (
            <StatCard label="Remaining payable" value={formatMoney(b.outstanding)} tone={b.outstanding.isZero() ? "positive" : "warning"} />
          )}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Work scope" description="What this contract covers" />
          <div className="grid gap-6 p-5 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-emerald-800">Included</h3>
              {included.length === 0 ? (
                <p className="text-sm text-slate-500">Nothing marked as included.</p>
              ) : (
                <ul className="space-y-1.5">
                  {included.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-sm text-slate-800"><Check className="size-4 text-emerald-600" /> {s.workCategory.name}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-red-800">Excluded</h3>
              {excluded.length === 0 ? (
                <p className="text-sm text-slate-500">Nothing marked as excluded.</p>
              ) : (
                <ul className="space-y-1.5">
                  {excluded.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-sm text-slate-800"><X className="size-4 text-red-600" /> {s.workCategory.name}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {k.description && (
            <div className="border-t border-slate-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Terms / description</h3>
              <p className="mt-1 text-sm whitespace-pre-line text-slate-600">{k.description}</p>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Work progress" />
          {canWrite ? (
            <ActionForm action={updateContractProgress.bind(null, id)} className="space-y-3 p-5">
              <FormField label="Status" name="status">
                <Select id="status" name="status" defaultValue={k.status}>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="TERMINATED">Terminated</option>
                </Select>
              </FormField>
              <FormField label="Progress %" name="progressPercent">
                <Input id="progressPercent" name="progressPercent" type="number" min={0} max={100} defaultValue={k.progressPercent} />
              </FormField>
              <SubmitButton variant="secondary" className="w-full">Update progress</SubmitButton>
            </ActionForm>
          ) : (
            <div className="p-5 text-sm text-slate-600">{voided ? "Voided contract." : `${k.progressPercent}% complete.`}</div>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Extra work and deductions"
          description="These change how much is owed to the contractor. They do not move cash."
        />
        {k.adjustments.length > 0 && (
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Type</TH>
                <TH>Reason</TH>
                <TH numeric>Amount</TH>
                <TH className="w-px"><span className="sr-only">Actions</span></TH>
              </tr>
            </THead>
            <TBody>
              {k.adjustments.map((a) => {
                const av = Boolean(a.voidedAt);
                return (
                  <TR key={a.id} className={av ? "text-slate-400" : undefined}>
                    <TD className={av ? "text-slate-400" : undefined}>{formatDate(a.date)}</TD>
                    <TD>{a.type === "EXTRA" ? <Badge tone="blue">Extra</Badge> : <Badge tone="amber">Deduction</Badge>}</TD>
                    <TD className="max-w-md whitespace-normal">
                      <span className={av ? "text-slate-400" : undefined}>{a.reason}</span>
                      {av && <div className="mt-1"><Badge tone="red">Voided</Badge> <span className="text-xs text-slate-500">{a.voidReason}</span></div>}
                    </TD>
                    <TD numeric className={av ? "text-slate-400 line-through" : "font-medium"}>
                      {a.type === "DEDUCTION" ? "− " : "+ "}{formatMoney(a.amount)}
                    </TD>
                    <TD>
                      {canWrite && !av && (
                        <VoidDialog
                          action={voidAdjustment.bind(null, a.id)}
                          title="Void this adjustment?"
                          description="It will no longer change the amount payable. It stays on record with your reason."
                        />
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
        {canWrite ? (
          <ActionForm action={createAdjustment.bind(null, id)} resetOnSuccess className="grid gap-3 border-t border-slate-100 p-5 sm:grid-cols-2 lg:grid-cols-5 lg:items-start">
            <FormField label="Type" name="type">
              <Select id="adj-type" name="type" defaultValue="EXTRA">
                <option value="EXTRA">Extra work (+)</option>
                <option value="DEDUCTION">Deduction (−)</option>
              </Select>
            </FormField>
            <FormField label="Amount (Rs.)" name="amount" htmlFor="adj-amount">
              <Input id="adj-amount" name="amount" inputMode="decimal" required />
            </FormField>
            <FormField label="Date" name="date" htmlFor="adj-date">
              <Input id="adj-date" name="date" type="date" defaultValue={todayPk()} max={todayPk()} required />
            </FormField>
            <FormField label="Reason" name="reason" htmlFor="adj-reason">
              <Input id="adj-reason" name="reason" required maxLength={500} placeholder="e.g. Boundary wall added" />
            </FormField>
            <div className="lg:pt-6"><SubmitButton variant="secondary" className="w-full">Add</SubmitButton></div>
          </ActionForm>
        ) : (
          k.adjustments.length === 0 && <EmptyState title="No extras or deductions" />
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Payments to contractor"
          description="Advances, installments and final payments. These are actual cash outflows from the project."
          actions={canWrite ? <ButtonLink href={`/contracts/${id}/payments/new`} size="sm"><Plus className="size-4" /> Pay contractor</ButtonLink> : undefined}
        />
        {k.payments.length === 0 ? (
          <EmptyState title="No payments yet" />
        ) : (
          <ContractorPaymentsTable payments={k.payments.map((p) => ({ ...p, contractId: k.id }))} isAdmin={canWrite} />
        )}
      </Card>
    </>
  );
}

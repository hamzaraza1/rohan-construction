"use server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUpload, saveUpload } from "@/lib/attachments";
import { formatMoney } from "@/lib/format";
import { adminMutation, toActionError, UserFacingError, type ActionResult, type Tx } from "@/lib/mutation";
import { checkbox, dateInput, formFields, money, optionalDateInput, optionalText, paymentMethod, requiredText } from "@/lib/validation";

// -----------------------------------------------------------------------------
// Contracts
// -----------------------------------------------------------------------------

const contractSchema = z
  .object({
    contractorId: z.string().min(1, "Choose a contractor"),
    title: requiredText(200),
    description: optionalText(2000),
    contractAmount: money(),
    startDate: dateInput(),
    endDate: optionalDateInput(),
    status: z.enum(["ACTIVE", "COMPLETED", "TERMINATED"]),
    progressPercent: z.coerce.number({ error: "Enter 0–100" }).int("Whole number").min(0, "Min 0").max(100, "Max 100"),
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, { path: ["endDate"], message: "Must be on or after the start date" });

/** Reads the work-scope selects: field "scope:<workCategoryId>" = included | excluded | "" */
function parseScope(fd: FormData) {
  const items: { workCategoryId: string; included: boolean }[] = [];
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("scope:") || (v !== "included" && v !== "excluded")) continue;
    items.push({ workCategoryId: k.slice(6), included: v === "included" });
  }
  return items;
}

async function assertActiveContractor(tx: Tx, contractorId: string) {
  const c = await tx.contractor.findUnique({ where: { id: contractorId } });
  if (!c || c.archivedAt) throw new UserFacingError("Choose an active contractor.");
}

function revalidateContract(projectId: string, contractorId: string, contractId?: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/contractors/${contractorId}`);
  revalidatePath("/contractors");
  if (contractId) revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/");
}

export async function createContract(projectId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  let contract: { id: string; contractorId: string };
  try {
    const data = contractSchema.parse(formFields(fd));
    const scope = parseScope(fd);
    contract = await adminMutation(async (tx, user) => {
      const project = await tx.project.findUnique({ where: { id: projectId } });
      if (!project || project.archivedAt) throw new UserFacingError("Project not found or archived.");
      await assertActiveContractor(tx, data.contractorId);
      return tx.contract.create({
        data: { ...data, projectId, createdById: user.id, scopeItems: { create: scope } },
      });
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidateContract(projectId, contract.contractorId);
  redirect(`/contracts/${contract.id}`);
}

export async function updateContract(contractId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  let current: { projectId: string; contractorId: string };
  try {
    const data = contractSchema.parse(formFields(fd));
    const scope = parseScope(fd);
    current = await adminMutation(async (tx) => {
      const c = await tx.contract.findUnique({ where: { id: contractId } });
      if (!c) throw new UserFacingError("Contract not found.");
      if (c.voidedAt) throw new UserFacingError("Voided contracts cannot be edited.");
      if (c.contractorId !== data.contractorId) await assertActiveContractor(tx, data.contractorId);
      await tx.contract.update({ where: { id: contractId }, data });
      await tx.contractScopeItem.deleteMany({ where: { contractId } });
      if (scope.length) await tx.contractScopeItem.createMany({ data: scope.map((s) => ({ ...s, contractId })) });
      return c;
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidateContract(current.projectId, current.contractorId, contractId);
  redirect(`/contracts/${contractId}`);
}

const progressSchema = z.object({
  status: z.enum(["ACTIVE", "COMPLETED", "TERMINATED"]),
  progressPercent: z.coerce.number({ error: "Enter 0–100" }).int("Whole number").min(0, "Min 0").max(100, "Max 100"),
});

export async function updateContractProgress(contractId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const data = progressSchema.parse(formFields(fd));
    const c = await adminMutation((tx) => tx.contract.update({ where: { id: contractId }, data }));
    revalidateContract(c.projectId, c.contractorId, contractId);
    return { ok: true, message: "Progress updated." };
  } catch (err) {
    return toActionError(err);
  }
}

const voidSchema = z.object({ reason: requiredText(500) });

export async function voidContract(contractId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const { reason } = voidSchema.parse(formFields(fd));
    const c = await adminMutation((tx) =>
      tx.contract.update({ where: { id: contractId }, data: { voidedAt: new Date(), voidReason: reason } }),
    );
    revalidateContract(c.projectId, c.contractorId, contractId);
    return { ok: true, message: "Contract voided." };
  } catch (err) {
    return toActionError(err);
  }
}

// -----------------------------------------------------------------------------
// Adjustments (extra work / deductions) — change what is owed, never cash
// -----------------------------------------------------------------------------

const adjustmentSchema = z.object({
  type: z.enum(["EXTRA", "DEDUCTION"], { error: "Choose extra or deduction" }),
  amount: money(),
  date: dateInput({ notInFuture: true }),
  reason: requiredText(500),
});

export async function createAdjustment(contractId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const data = adjustmentSchema.parse(formFields(fd));
    const c = await adminMutation(async (tx, user) => {
      const contract = await lockContract(tx, contractId);
      if (data.type === "DEDUCTION") {
        const { netPayable } = await balanceOf(tx, contractId);
        if (new Prisma.Decimal(data.amount).greaterThan(netPayable)) {
          throw new UserFacingError(`A deduction cannot exceed the current net payable (${formatMoney(netPayable)}).`);
        }
      }
      await tx.contractAdjustment.create({ data: { ...data, contractId, createdById: user.id } });
      return contract;
    });
    revalidateContract(c.projectId, c.contractorId, contractId);
    return { ok: true, message: data.type === "EXTRA" ? "Extra work added." : "Deduction recorded." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function voidAdjustment(adjustmentId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const { reason } = voidSchema.parse(formFields(fd));
    const c = await adminMutation(async (tx) => {
      const a = await tx.contractAdjustment.update({ where: { id: adjustmentId }, data: { voidedAt: new Date(), voidReason: reason } });
      return tx.contract.findUniqueOrThrow({ where: { id: a.contractId } });
    });
    revalidateContract(c.projectId, c.contractorId, c.id);
    return { ok: true, message: "Adjustment voided." };
  } catch (err) {
    return toActionError(err);
  }
}

// -----------------------------------------------------------------------------
// Contractor payments — the only contractor records that move cash
// -----------------------------------------------------------------------------

const paymentSchema = z.object({
  type: z.enum(["ADVANCE", "INSTALLMENT", "FINAL"], { error: "Choose the payment type" }),
  amount: money(),
  date: dateInput({ notInFuture: true }),
  method: paymentMethod,
  reference: optionalText(100),
  description: optionalText(1000),
  allowOverpayment: checkbox,
  removeAttachment: checkbox,
});

/** Row lock so two simultaneous payments cannot both pass the balance check. */
async function lockContract(tx: Tx, contractId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Contract" WHERE "id" = ${contractId} FOR UPDATE`;
  if (rows.length === 0) throw new UserFacingError("Contract not found.");
  const c = await tx.contract.findUniqueOrThrow({ where: { id: contractId }, include: { project: true } });
  if (c.voidedAt) throw new UserFacingError("This contract is voided.");
  return c;
}

async function balanceOf(tx: Tx, contractId: string) {
  const [b] = await tx.$queryRaw<{ netPayable: Prisma.Decimal; paid: Prisma.Decimal }[]>`
    SELECT "netPayable", "paid" FROM "ContractBalance" WHERE "contractId" = ${contractId}`;
  return b;
}

function overpaymentError(remaining: Prisma.Decimal) {
  return new UserFacingError(
    `This payment is more than the remaining balance of ${formatMoney(Prisma.Decimal.max(remaining, 0))}. ` +
      `If that is intended (e.g. extra work not yet added), tick "Allow overpayment".`,
  );
}

export async function createContractorPayment(contractId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const cleanups: Array<() => Promise<unknown>> = [];
  let projectId: string, contractorId: string;
  try {
    const { allowOverpayment, removeAttachment: _r, ...data } = paymentSchema.parse(formFields(fd));
    void _r;
    const file = getUpload(fd, "attachment");
    ({ projectId, contractorId } = await adminMutation(async (tx, user) => {
      const c = await lockContract(tx, contractId);
      if (c.project.archivedAt) throw new UserFacingError("The project is archived. Restore it before recording payments.");
      const { netPayable, paid } = await balanceOf(tx, contractId);
      const remaining = netPayable.minus(paid);
      if (!allowOverpayment && new Prisma.Decimal(data.amount).greaterThan(remaining)) throw overpaymentError(remaining);
      let attachmentId: string | null = null;
      if (file) {
        const saved = await saveUpload(tx, file, user.id);
        cleanups.push(saved.cleanup);
        attachmentId = saved.id;
      }
      await tx.contractorPayment.create({
        data: { ...data, contractId, projectId: c.projectId, attachmentId, createdById: user.id },
      });
      return c;
    }));
  } catch (err) {
    await Promise.all(cleanups.map((c) => c()));
    return toActionError(err);
  }
  revalidateContract(projectId, contractorId, contractId);
  redirect(`/contracts/${contractId}`);
}

export async function updateContractorPayment(paymentId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const cleanups: Array<() => Promise<unknown>> = [];
  let c: { id: string; projectId: string; contractorId: string };
  try {
    const { allowOverpayment, removeAttachment, ...data } = paymentSchema.parse(formFields(fd));
    const file = getUpload(fd, "attachment");
    c = await adminMutation(async (tx, user) => {
      const current = await tx.contractorPayment.findUnique({ where: { id: paymentId } });
      if (!current) throw new UserFacingError("Payment not found.");
      if (current.voidedAt) throw new UserFacingError("Voided payments cannot be edited.");
      const contract = await lockContract(tx, current.contractId);
      const { netPayable, paid } = await balanceOf(tx, current.contractId);
      const remaining = netPayable.minus(paid).plus(current.amount);
      if (!allowOverpayment && new Prisma.Decimal(data.amount).greaterThan(remaining)) throw overpaymentError(remaining);
      let attachmentId = removeAttachment ? null : current.attachmentId;
      if (file) {
        const saved = await saveUpload(tx, file, user.id);
        cleanups.push(saved.cleanup);
        attachmentId = saved.id;
      }
      await tx.contractorPayment.update({ where: { id: paymentId }, data: { ...data, attachmentId } });
      return contract;
    });
  } catch (err) {
    await Promise.all(cleanups.map((x) => x()));
    return toActionError(err);
  }
  revalidateContract(c.projectId, c.contractorId, c.id);
  redirect(`/contracts/${c.id}`);
}

export async function voidContractorPayment(paymentId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const { reason } = voidSchema.parse(formFields(fd));
    const c = await adminMutation(async (tx) => {
      const p = await tx.contractorPayment.findUnique({ where: { id: paymentId } });
      if (!p) throw new UserFacingError("Payment not found.");
      if (p.voidedAt) throw new UserFacingError("This payment is already voided.");
      await tx.contractorPayment.update({ where: { id: paymentId }, data: { voidedAt: new Date(), voidReason: reason } });
      return tx.contract.findUniqueOrThrow({ where: { id: p.contractId } });
    });
    revalidateContract(c.projectId, c.contractorId, c.id);
    return { ok: true, message: "Payment voided. It no longer counts in any balance." };
  } catch (err) {
    return toActionError(err);
  }
}

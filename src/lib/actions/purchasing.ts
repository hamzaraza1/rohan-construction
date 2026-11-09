"use server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUpload, saveUpload } from "@/lib/attachments";
import { formatMoney, formatNumber } from "@/lib/format";
import { adminMutation, toActionError, UserFacingError, type ActionResult, type Tx } from "@/lib/mutation";
import {
  checkbox, dateInput, formFields, money, optionalDateInput, optionalText, paymentMethod, quantity, rate, requiredText,
} from "@/lib/validation";

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

function revalidateSupply(projectId: string, supplierId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/suppliers");
  revalidatePath("/inventory");
  revalidatePath("/");
}

async function activeProjectAndSupplier(tx: Tx, projectId: string, supplierId: string) {
  const [project, supplier] = await Promise.all([
    tx.project.findUnique({ where: { id: projectId } }),
    tx.supplier.findUnique({ where: { id: supplierId } }),
  ]);
  if (!project || project.archivedAt) throw new UserFacingError("Project not found or archived.");
  if (!supplier || supplier.archivedAt) throw new UserFacingError("Choose an active supplier.");
  return { project, supplier };
}

/**
 * Reads repeated line fields (materialId / quantity / rate / poLineId) from the
 * form. Rows with an empty quantity are skipped (lets a receipt pre-filled from
 * an order leave some lines out).
 */
function parseLines(fd: FormData, opts: { withPoLine?: boolean } = {}) {
  const mats = fd.getAll("materialId").map(String);
  const qtys = fd.getAll("quantity").map(String);
  const rates = fd.getAll("rate").map(String);
  const poLines = fd.getAll("poLineId").map(String);
  const lines: { materialId: string; quantity: string; rate: string; poLineId: string | null }[] = [];
  const errors: string[] = [];
  mats.forEach((materialId, i) => {
    const q = (qtys[i] ?? "").trim();
    if (!materialId && !q) return; // blank row
    if (!q || q === "0") return;
    if (!materialId) return errors.push(`Line ${i + 1}: choose a material.`);
    const qp = quantity().safeParse(q);
    const rp = rate().safeParse(rates[i] ?? "");
    if (!qp.success) return errors.push(`Line ${i + 1}: ${qp.error.issues[0].message}.`);
    if (!rp.success) return errors.push(`Line ${i + 1}: rate — ${rp.error.issues[0].message}.`);
    lines.push({ materialId, quantity: qp.data, rate: rp.data, poLineId: opts.withPoLine ? poLines[i] || null : null });
  });
  if (errors.length) throw new UserFacingError(errors.join(" "));
  if (lines.length === 0) throw new UserFacingError("Add at least one line with a quantity.");
  return lines;
}

const total = (lines: { quantity: string; rate: string }[]) =>
  lines.reduce((a, l) => a.plus(D(l.quantity).mul(l.rate).toDecimalPlaces(2)), D(0));

// -----------------------------------------------------------------------------
// Purchase orders — commitments only; they never move cash or stock
// -----------------------------------------------------------------------------

const poSchema = z
  .object({
    supplierId: z.string().min(1, "Choose a supplier"),
    orderDate: dateInput(),
    expectedDate: optionalDateInput(),
    notes: optionalText(2000),
  })
  .refine((d) => !d.expectedDate || d.expectedDate >= d.orderDate, { path: ["expectedDate"], message: "Must be on or after the order date" });

export async function createPurchaseOrder(projectId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  let po: { id: string; supplierId: string };
  try {
    const data = poSchema.parse(formFields(fd));
    const lines = parseLines(fd);
    po = await adminMutation(async (tx, user) => {
      await activeProjectAndSupplier(tx, projectId, data.supplierId);
      return tx.purchaseOrder.create({
        data: {
          ...data,
          projectId,
          createdById: user.id,
          lines: { create: lines.map(({ materialId, quantity, rate }) => ({ materialId, quantity, rate })) },
        },
      });
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidateSupply(projectId, po.supplierId);
  redirect(`/purchase-orders/${po.id}`);
}

export async function updatePurchaseOrder(poId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  let po: { projectId: string; supplierId: string };
  try {
    const data = poSchema.parse(formFields(fd));
    const lines = parseLines(fd);
    po = await adminMutation(async (tx) => {
      const current = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: { _count: { select: { receipts: true } } } });
      if (!current) throw new UserFacingError("Purchase order not found.");
      if (current.status !== "OPEN") throw new UserFacingError("Only open purchase orders can be edited.");
      if (current._count.receipts > 0) throw new UserFacingError("Material has already been received on this order, so its lines are fixed. Close it and create a new order for changes.");
      await tx.purchaseOrder.update({ where: { id: poId }, data });
      await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: poId } });
      await tx.purchaseOrderLine.createMany({ data: lines.map(({ materialId, quantity, rate }) => ({ purchaseOrderId: poId, materialId, quantity, rate })) });
      return current;
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidateSupply(po.projectId, po.supplierId);
  redirect(`/purchase-orders/${poId}`);
}

export async function setPurchaseOrderStatus(poId: string, status: "OPEN" | "CLOSED" | "CANCELLED"): Promise<ActionResult> {
  try {
    const po = await adminMutation((tx) => tx.purchaseOrder.update({ where: { id: poId }, data: { status } }));
    revalidateSupply(po.projectId, po.supplierId);
    revalidatePath(`/purchase-orders/${poId}`);
    return { ok: true, message: { OPEN: "Order reopened.", CLOSED: "Order closed. Undelivered value is released.", CANCELLED: "Order cancelled." }[status] };
  } catch (err) {
    return toActionError(err);
  }
}

// -----------------------------------------------------------------------------
// Material receipts — the ONLY thing that adds stock and counts material cost
// -----------------------------------------------------------------------------

const receiptSchema = z.object({
  supplierId: z.string().min(1, "Choose a supplier"),
  purchaseOrderId: z.string().optional().transform((v) => v || null),
  receiptDate: dateInput({ notInFuture: true }),
  challanNumber: optionalText(60),
  notes: optionalText(1000),
  allowOverDelivery: checkbox,
  paidNow: checkbox,
  paidMethod: z.string().optional(),
});

export async function createReceipt(projectId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const cleanups: Array<() => Promise<unknown>> = [];
  let receipt: { id: string; supplierId: string };
  try {
    const { allowOverDelivery, paidNow, paidMethod, ...data } = receiptSchema.parse(formFields(fd));
    const lines = parseLines(fd, { withPoLine: true });
    const method = paidNow ? paymentMethod.parse(paidMethod) : null;
    const file = getUpload(fd, "attachment");
    receipt = await adminMutation(async (tx, user) => {
      await activeProjectAndSupplier(tx, projectId, data.supplierId);

      if (data.purchaseOrderId) {
        // Lock the order so two receipts cannot both exceed it.
        await tx.$queryRaw`SELECT 1 FROM "PurchaseOrder" WHERE "id" = ${data.purchaseOrderId} FOR UPDATE`;
        const po = await tx.purchaseOrder.findUnique({ where: { id: data.purchaseOrderId }, include: { lines: { include: { material: true } } } });
        if (!po || po.projectId !== projectId || po.supplierId !== data.supplierId) throw new UserFacingError("Purchase order does not match this project and supplier.");
        if (!allowOverDelivery) {
          const received = await tx.$queryRaw<{ poLineId: string; receivedQty: Prisma.Decimal }[]>`
            SELECT "poLineId", "receivedQty" FROM "PurchaseOrderLineBalance" WHERE "purchaseOrderId" = ${po.id}`;
          const recMap = new Map(received.map((r) => [r.poLineId, r.receivedQty]));
          for (const l of lines) {
            const pol = po.lines.find((x) => x.id === l.poLineId);
            if (!pol) continue;
            const remaining = pol.quantity.minus(recMap.get(pol.id) ?? 0);
            if (D(l.quantity).greaterThan(remaining)) {
              throw new UserFacingError(
                `${pol.material.name}: receiving ${formatNumber(l.quantity)} ${pol.material.unit} but only ${formatNumber(Prisma.Decimal.max(remaining, 0))} remain on the order. Tick "Allow more than ordered" if the supplier really delivered extra.`,
              );
            }
          }
        }
      } else if (lines.some((l) => l.poLineId)) {
        throw new UserFacingError("Order lines can only be used with their purchase order.");
      }

      let attachmentId: string | null = null;
      if (file) {
        const saved = await saveUpload(tx, file, user.id);
        cleanups.push(saved.cleanup);
        attachmentId = saved.id;
      }
      const created = await tx.materialReceipt.create({
        data: { ...data, projectId, attachmentId, createdById: user.id, lines: { create: lines } },
      });
      // Cash purchase: the supplier is paid in full on the spot (receipt + payment together).
      if (method) {
        await tx.supplierPayment.create({
          data: {
            projectId, supplierId: data.supplierId, purchaseOrderId: data.purchaseOrderId, type: "PAYMENT",
            amount: total(lines).toFixed(2), date: data.receiptDate, method,
            description: `Paid on delivery${data.challanNumber ? ` — challan ${data.challanNumber}` : ""}`,
            createdById: user.id,
          },
        });
      }
      return created;
    });
  } catch (err) {
    await Promise.all(cleanups.map((c) => c()));
    return toActionError(err);
  }
  revalidateSupply(projectId, receipt.supplierId);
  redirect(`/receipts/${receipt.id}`);
}

const voidSchema = z.object({ reason: requiredText(500) });

export async function voidReceipt(receiptId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const { reason } = voidSchema.parse(formFields(fd));
    const r = await adminMutation(async (tx) => {
      const current = await tx.materialReceipt.findUnique({ where: { id: receiptId } });
      if (!current) throw new UserFacingError("Receipt not found.");
      if (current.voidedAt) throw new UserFacingError("Already voided.");
      return tx.materialReceipt.update({ where: { id: receiptId }, data: { voidedAt: new Date(), voidReason: reason } });
    });
    revalidateSupply(r.projectId, r.supplierId);
    revalidatePath(`/receipts/${receiptId}`);
    return { ok: true, message: "Receipt voided. Its stock and material value were removed." };
  } catch (err) {
    return toActionError(err);
  }
}

// -----------------------------------------------------------------------------
// Supplier payments (advances and payments against deliveries) — cash out
// -----------------------------------------------------------------------------

const supplierPaymentSchema = z.object({
  type: z.enum(["ADVANCE", "PAYMENT"], { error: "Choose advance or payment" }),
  purchaseOrderId: z.string().optional().transform((v) => v || null),
  amount: money(),
  date: dateInput({ notInFuture: true }),
  method: paymentMethod,
  reference: optionalText(100),
  description: optionalText(1000),
  removeAttachment: checkbox,
});

export async function createSupplierPayment(projectId: string, supplierId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const cleanups: Array<() => Promise<unknown>> = [];
  try {
    const { removeAttachment: _r, ...data } = supplierPaymentSchema.parse(formFields(fd));
    void _r;
    const file = getUpload(fd, "attachment");
    await adminMutation(async (tx, user) => {
      await activeProjectAndSupplier(tx, projectId, supplierId);
      let attachmentId: string | null = null;
      if (file) {
        const saved = await saveUpload(tx, file, user.id);
        cleanups.push(saved.cleanup);
        attachmentId = saved.id;
      }
      await tx.supplierPayment.create({ data: { ...data, projectId, supplierId, attachmentId, createdById: user.id } });
    });
  } catch (err) {
    await Promise.all(cleanups.map((c) => c()));
    return toActionError(err);
  }
  revalidateSupply(projectId, supplierId);
  redirect(`/projects/${projectId}?tab=suppliers`);
}

export async function updateSupplierPayment(paymentId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const cleanups: Array<() => Promise<unknown>> = [];
  let p: { projectId: string; supplierId: string };
  try {
    const { removeAttachment, ...data } = supplierPaymentSchema.parse(formFields(fd));
    const file = getUpload(fd, "attachment");
    p = await adminMutation(async (tx, user) => {
      const current = await tx.supplierPayment.findUnique({ where: { id: paymentId } });
      if (!current) throw new UserFacingError("Payment not found.");
      if (current.voidedAt) throw new UserFacingError("Voided payments cannot be edited.");
      let attachmentId = removeAttachment ? null : current.attachmentId;
      if (file) {
        const saved = await saveUpload(tx, file, user.id);
        cleanups.push(saved.cleanup);
        attachmentId = saved.id;
      }
      await tx.supplierPayment.update({ where: { id: paymentId }, data: { ...data, attachmentId } });
      return current;
    });
  } catch (err) {
    await Promise.all(cleanups.map((c) => c()));
    return toActionError(err);
  }
  revalidateSupply(p.projectId, p.supplierId);
  redirect(`/projects/${p.projectId}?tab=suppliers`);
}

export async function voidSupplierPayment(paymentId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const { reason } = voidSchema.parse(formFields(fd));
    const p = await adminMutation(async (tx) => {
      const current = await tx.supplierPayment.findUnique({ where: { id: paymentId } });
      if (!current) throw new UserFacingError("Payment not found.");
      if (current.voidedAt) throw new UserFacingError("Already voided.");
      return tx.supplierPayment.update({ where: { id: paymentId }, data: { voidedAt: new Date(), voidReason: reason } });
    });
    revalidateSupply(p.projectId, p.supplierId);
    return { ok: true, message: `Payment of ${formatMoney(p.amount)} voided.` };
  } catch (err) {
    return toActionError(err);
  }
}

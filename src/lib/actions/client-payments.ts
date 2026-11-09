"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUpload, saveUpload } from "@/lib/attachments";
import { adminMutation, toActionError, UserFacingError, type ActionResult } from "@/lib/mutation";
import { checkbox, dateInput, formFields, money, optionalText, paymentMethod, requiredText } from "@/lib/validation";

const paymentSchema = z.object({
  amount: money(),
  date: dateInput({ notInFuture: true }),
  method: paymentMethod,
  reference: optionalText(100),
  description: optionalText(1000),
  removeAttachment: checkbox,
});

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/clients", "layout");
  revalidatePath("/");
}

export async function createClientPayment(projectId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const cleanups: Array<() => Promise<unknown>> = [];
  try {
    const { removeAttachment: _ignored, ...data } = paymentSchema.parse(formFields(fd));
    const file = getUpload(fd, "attachment");
    await adminMutation(async (tx, user) => {
      const project = await tx.project.findUnique({ where: { id: projectId } });
      if (!project) throw new UserFacingError("Project not found.");
      if (project.archivedAt) throw new UserFacingError("This project is archived. Restore it before recording payments.");
      let attachmentId: string | null = null;
      if (file) {
        const saved = await saveUpload(tx, file, user.id);
        cleanups.push(saved.cleanup);
        attachmentId = saved.id;
      }
      await tx.clientPayment.create({ data: { ...data, projectId, attachmentId, createdById: user.id } });
    });
  } catch (err) {
    await Promise.all(cleanups.map((c) => c()));
    return toActionError(err);
  }
  revalidateProject(projectId);
  redirect(`/projects/${projectId}?tab=payments`);
}

export async function updateClientPayment(paymentId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const cleanups: Array<() => Promise<unknown>> = [];
  let projectId: string;
  try {
    const { removeAttachment, ...data } = paymentSchema.parse(formFields(fd));
    const file = getUpload(fd, "attachment");
    projectId = await adminMutation(async (tx, user) => {
      const current = await tx.clientPayment.findUnique({ where: { id: paymentId } });
      if (!current) throw new UserFacingError("Payment not found.");
      if (current.voidedAt) throw new UserFacingError("Voided payments cannot be edited.");
      let attachmentId = removeAttachment ? null : current.attachmentId;
      if (file) {
        const saved = await saveUpload(tx, file, user.id);
        cleanups.push(saved.cleanup);
        attachmentId = saved.id;
      }
      await tx.clientPayment.update({ where: { id: paymentId }, data: { ...data, attachmentId } });
      return current.projectId;
    });
  } catch (err) {
    await Promise.all(cleanups.map((c) => c()));
    return toActionError(err);
  }
  revalidateProject(projectId);
  redirect(`/projects/${projectId}?tab=payments`);
}

const voidSchema = z.object({ reason: requiredText(500) });

export async function voidClientPayment(paymentId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const { reason } = voidSchema.parse(formFields(fd));
    const projectId = await adminMutation(async (tx) => {
      const current = await tx.clientPayment.findUnique({ where: { id: paymentId } });
      if (!current) throw new UserFacingError("Payment not found.");
      if (current.voidedAt) throw new UserFacingError("This payment is already voided.");
      await tx.clientPayment.update({ where: { id: paymentId }, data: { voidedAt: new Date(), voidReason: reason } });
      return current.projectId;
    });
    revalidateProject(projectId);
    return { ok: true, message: "Payment voided. It no longer counts in any balance." };
  } catch (err) {
    return toActionError(err);
  }
}

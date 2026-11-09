"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminMutation, toActionError, UserFacingError, type ActionResult } from "@/lib/mutation";
import { dateInput, formFields, optionalText, quantity, requiredText } from "@/lib/validation";

const movementSchema = z
  .object({
    materialId: z.string().min(1, "Choose a material"),
    type: z.enum(["ISSUE", "WASTAGE", "ADJUSTMENT"], { error: "Choose a movement type" }),
    direction: z.enum(["IN", "OUT"]).optional(),
    quantity: quantity(),
    date: dateInput({ notInFuture: true }),
    notes: optionalText(500),
  })
  .refine((d) => d.type !== "ADJUSTMENT" || (d.notes ?? "").length > 0, { path: ["notes"], message: "Explain the stock-count correction" })
  .transform((d) => ({
    materialId: d.materialId,
    type: d.type,
    date: d.date,
    notes: d.notes,
    // ADJUSTMENT is stored signed: + found extra, − missing.
    quantity: d.type === "ADJUSTMENT" && d.direction === "OUT" ? `-${d.quantity}` : d.quantity,
  }));

export async function createStockMovement(projectId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const data = movementSchema.parse(formFields(fd));
    await adminMutation(async (tx, user) => {
      const project = await tx.project.findUnique({ where: { id: projectId } });
      if (!project || project.archivedAt) throw new UserFacingError("Project not found or archived.");
      await tx.stockMovement.create({ data: { ...data, projectId, createdById: user.id } });
    });
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/inventory");
    return { ok: true, message: { ISSUE: "Issue recorded.", WASTAGE: "Wastage recorded.", ADJUSTMENT: "Stock adjusted." }[data.type] };
  } catch (err) {
    return toActionError(err);
  }
}

export async function voidStockMovement(id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const { reason } = z.object({ reason: requiredText(500) }).parse(formFields(fd));
    const m = await adminMutation((tx) => tx.stockMovement.update({ where: { id }, data: { voidedAt: new Date(), voidReason: reason } }));
    revalidatePath(`/projects/${m.projectId}`);
    revalidatePath("/inventory");
    return { ok: true, message: "Stock entry voided." };
  } catch (err) {
    return toActionError(err);
  }
}

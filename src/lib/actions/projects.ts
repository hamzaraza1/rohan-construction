"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminMutation, toActionError, UserFacingError, type ActionResult } from "@/lib/mutation";
import { dateInput, formFields, optionalDateInput, optionalMoney, optionalText, percent, requiredText } from "@/lib/validation";

const base = z.object({
  name: requiredText(150),
  clientId: z.string().min(1, "Choose a client"),
  siteAddress: requiredText(300),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]),
  startDate: dateInput(),
  expectedCompletionDate: optionalDateInput(),
  description: optionalText(2000),
});

// The contract type decides which money fields apply.
const projectSchema = z
  .discriminatedUnion("type", [
    base.extend({ type: z.literal("COMMISSION"), commissionPercent: percent() }),
    base.extend({ type: z.literal("WITH_MATERIAL"), clientContractAmount: optionalMoney() }),
    base.extend({ type: z.literal("LABOUR_RATE"), clientContractAmount: optionalMoney() }),
  ], { error: "Choose a contract type" })
  .refine((d) => !d.expectedCompletionDate || d.expectedCompletionDate >= d.startDate, {
    path: ["expectedCompletionDate"],
    message: "Must be on or after the start date",
  })
  .transform((d) => ({
    ...d,
    commissionPercent: d.type === "COMMISSION" ? d.commissionPercent : null,
    clientContractAmount: d.type === "COMMISSION" ? null : d.clientContractAmount,
  }));

export async function createProject(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const data = projectSchema.parse(formFields(fd));
    id = (
      await adminMutation(async (tx) => {
        const client = await tx.client.findUnique({ where: { id: data.clientId } });
        if (!client || client.archivedAt) throw new UserFacingError("Choose an active client.");
        return tx.project.create({ data });
      })
    ).id;
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/projects");
  redirect(`/projects/${id}`);
}

export async function updateProject(id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const data = projectSchema.parse(formFields(fd));
    await adminMutation(async (tx) => {
      const current = await tx.project.findUniqueOrThrow({ where: { id } });
      if (current.clientId !== data.clientId) {
        const client = await tx.client.findUnique({ where: { id: data.clientId } });
        if (!client || client.archivedAt) throw new UserFacingError("Choose an active client.");
      }
      await tx.project.update({ where: { id }, data });
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/projects");
  redirect(`/projects/${id}`);
}

export async function setProjectArchived(id: string, archived: boolean): Promise<ActionResult> {
  try {
    await adminMutation((tx) => tx.project.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } }));
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    revalidatePath("/");
    return { ok: true, message: archived ? "Project archived." : "Project restored." };
  } catch (err) {
    return toActionError(err);
  }
}

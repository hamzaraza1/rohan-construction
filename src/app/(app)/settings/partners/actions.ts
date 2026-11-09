"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminMutation, toActionError, UserFacingError, type ActionResult } from "@/lib/mutation";

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(100),
  userId: z.string().transform((v) => v || null),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.literal("on").optional(),
});

export async function createPartner(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const data = schema.parse({ ...Object.fromEntries(formData), isActive: "on" });
    await adminMutation((tx) =>
      tx.partner.create({ data: { name: data.name, userId: data.userId, sortOrder: data.sortOrder } }),
    );
    revalidatePath("/settings/partners");
    return { ok: true, message: `Partner "${data.name}" added.` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updatePartner(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const data = schema.parse(Object.fromEntries(formData));
    await adminMutation((tx) =>
      tx.partner.update({
        where: { id },
        data: { name: data.name, userId: data.userId, sortOrder: data.sortOrder, isActive: data.isActive === "on" },
      }),
    );
    revalidatePath("/settings/partners");
    return { ok: true, message: "Partner updated." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deletePartner(id: string, _prev: ActionResult | null): Promise<ActionResult> {
  try {
    await adminMutation(async (tx) => {
      const used = await tx.partnerWithdrawal.count({ where: { partnerId: id } });
      if (used > 0) throw new UserFacingError("This partner has withdrawal records. Deactivate the partner instead.");
      await tx.partner.delete({ where: { id } });
    });
    revalidatePath("/settings/partners");
    return { ok: true, message: "Partner removed." };
  } catch (err) {
    return toActionError(err);
  }
}

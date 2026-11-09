"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { categoryDelegate, isCategoryKind, type CategoryKind } from "@/lib/categories";
import { adminMutation, toActionError, UserFacingError, type ActionResult } from "@/lib/mutation";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
  isActive: z.literal("on").optional(),
  isMiscellaneous: z.literal("on").optional(),
});

function kindOrThrow(kind: string): CategoryKind {
  if (!isCategoryKind(kind)) throw new UserFacingError("Unknown category type.");
  return kind;
}

export async function createCategory(kind: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const k = kindOrThrow(kind);
    const data = schema.parse(Object.fromEntries(formData));
    await adminMutation(async (tx) => {
      const { model } = categoryDelegate(tx, k);
      const max = await model.aggregate({ _max: { sortOrder: true } });
      await model.create({
        data: {
          name: data.name,
          sortOrder: (max._max.sortOrder ?? 0) + 1,
          ...(k === "expense" ? { isMiscellaneous: data.isMiscellaneous === "on" } : {}),
        },
      });
    });
    revalidatePath(`/settings/categories/${k}`);
    return { ok: true, message: `"${data.name}" added.` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateCategory(kind: string, id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const k = kindOrThrow(kind);
    const data = schema.parse(Object.fromEntries(formData));
    await adminMutation(async (tx) => {
      const { model } = categoryDelegate(tx, k);
      const current = await model.findUniqueOrThrow({ where: { id } });
      const isSystem = Boolean(current.systemKey);
      if (isSystem && data.isActive !== "on") throw new UserFacingError("System categories cannot be deactivated.");
      await model.update({
        where: { id },
        data: {
          name: data.name,
          sortOrder: data.sortOrder,
          isActive: data.isActive === "on",
          ...(k === "expense" ? { isMiscellaneous: data.isMiscellaneous === "on" } : {}),
        },
      });
    });
    revalidatePath(`/settings/categories/${k}`);
    return { ok: true, message: "Saved." };
  } catch (err) {
    return toActionError(err);
  }
}

/** Deletion is only allowed when nothing uses the category; otherwise deactivate it. */
export async function deleteCategory(kind: string, id: string, _prev: ActionResult | null): Promise<ActionResult> {
  try {
    const k = kindOrThrow(kind);
    await adminMutation(async (tx) => {
      const { model, usageRelation } = categoryDelegate(tx, k);
      const current = await model.findUniqueOrThrow({
        where: { id },
        include: { _count: { select: { [usageRelation]: true } } },
      });
      if (current.systemKey) throw new UserFacingError("System categories cannot be deleted.");
      const used = (current._count as Record<string, number>)[usageRelation];
      if (used > 0) throw new UserFacingError(`In use by ${used} record(s). Deactivate it instead so history stays intact.`);
      await model.delete({ where: { id } });
    });
    revalidatePath(`/settings/categories/${k}`);
    return { ok: true, message: "Deleted." };
  } catch (err) {
    return toActionError(err);
  }
}

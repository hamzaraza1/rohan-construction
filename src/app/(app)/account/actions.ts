"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/auth/password";
import { destroyAllSessionsForUser } from "@/lib/auth/session";
import { toActionError, writeAudit, type ActionResult } from "@/lib/mutation";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters`).max(200),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

/** Any signed-in user (including read-only partners) may change their OWN password. */
export async function changeOwnPassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = schema.parse(Object.fromEntries(formData));
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await verifyPassword(row.passwordHash, data.currentPassword))) {
      return { ok: false, error: "Current password is incorrect.", fieldErrors: { currentPassword: ["Incorrect password"] } };
    }
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(data.newPassword), passwordChangedAt: new Date() },
    });
    await destroyAllSessionsForUser(user.id, true);
    await writeAudit(db, { userId: user.id, action: "PASSWORD_CHANGED", entityType: "User", entityId: user.id });
    return { ok: true, message: "Password changed. Other devices have been signed out." };
  } catch (err) {
    return toActionError(err);
  }
}

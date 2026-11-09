"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { adminMutation, toActionError, UserFacingError, writeAudit, type ActionResult, type Tx } from "@/lib/mutation";

const PUBLIC_FIELDS = { id: true, name: true, username: true, email: true, role: true, isActive: true } as const;

const name = z.string().trim().min(1, "Required").max(100);
const email = z.union([z.literal(""), z.email("Invalid email")]).transform((v) => v || null);
const role = z.enum(["ADMIN", "VIEWER"]);
const password = z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`).max(200);

const createSchema = z.object({
  name,
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,32}$/, "3–32 characters: letters, numbers, dot, dash, underscore"),
  email,
  role,
  password,
});

const updateSchema = z.object({ name, email, role, isActive: z.literal("on").optional() });

async function assertAnotherActiveAdmin(tx: Tx, excludingUserId: string) {
  const admins = await tx.user.count({ where: { role: "ADMIN", isActive: true, id: { not: excludingUserId } } });
  if (admins === 0) throw new UserFacingError("At least one active administrator must remain.");
}

export async function createUser(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const data = createSchema.parse(Object.fromEntries(formData));
    const passwordHash = await hashPassword(data.password);
    await adminMutation(async (tx, actor) => {
      const created = await tx.user.create({
        data: { name: data.name, username: data.username, email: data.email, role: data.role, passwordHash },
        select: PUBLIC_FIELDS,
      });
      await writeAudit(tx, { userId: actor.id, action: "USER_CREATED", entityType: "User", entityId: created.id, after: created });
    });
    revalidatePath("/settings/users");
    return { ok: true, message: `User "${data.username}" created.` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateUser(userId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const data = updateSchema.parse(Object.fromEntries(formData));
    const isActive = data.isActive === "on";
    await adminMutation(async (tx, actor) => {
      const before = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: PUBLIC_FIELDS });
      if (userId === actor.id && (data.role !== "ADMIN" || !isActive)) {
        throw new UserFacingError("You cannot remove your own admin role or deactivate yourself.");
      }
      if (before.role === "ADMIN" && before.isActive && (data.role !== "ADMIN" || !isActive)) {
        await assertAnotherActiveAdmin(tx, userId);
      }
      const after = await tx.user.update({
        where: { id: userId },
        data: { name: data.name, email: data.email, role: data.role, isActive },
        select: PUBLIC_FIELDS,
      });
      // Role or status change: force re-login everywhere.
      if (before.role !== after.role || before.isActive !== after.isActive) {
        await tx.session.deleteMany({ where: { userId } });
      }
      await writeAudit(tx, { userId: actor.id, action: "USER_UPDATED", entityType: "User", entityId: userId, before, after });
    });
    revalidatePath("/settings/users");
    return { ok: true, message: "User updated." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function resetUserPassword(userId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const newPassword = password.parse(formData.get("password"));
    const passwordHash = await hashPassword(newPassword);
    await adminMutation(async (tx, actor) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
      });
      if (userId !== actor.id) await tx.session.deleteMany({ where: { userId } });
      await writeAudit(tx, { userId: actor.id, action: "USER_PASSWORD_RESET", entityType: "User", entityId: userId });
    });
    return { ok: true, message: "Password reset. The user has been signed out of all devices." };
  } catch (err) {
    return toActionError(err);
  }
}

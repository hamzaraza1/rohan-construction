import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { PermissionError, requireAdmin } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";

export type Tx = Prisma.TransactionClient;

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

/**
 * The ONLY way business data is written.
 *  1. Verifies (in application code) that the caller is an active admin.
 *  2. Opens a transaction and sets `app.user_id` so database triggers can
 *     re-verify the admin role, stamp createdBy/updatedBy and write the audit log.
 */
export async function adminMutation<T>(fn: (tx: Tx, user: SessionUser) => Promise<T>): Promise<T> {
  const user = await requireAdmin();
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${user.id}, true)`;
    return fn(tx, user);
  });
}

export class UserFacingError extends Error {}

/** Converts any thrown error into a safe, user-readable ActionResult. */
export function toActionError(err: unknown): ActionResult<never> {
  if (err instanceof z.ZodError) {
    return {
      ok: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: z.flattenError(err).fieldErrors as Record<string, string[]>,
    };
  }
  if (err instanceof PermissionError || err instanceof UserFacingError) {
    return { ok: false, error: err.message };
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return { ok: false, error: "A record with this name already exists." };
    if (err.code === "P2003") return { ok: false, error: "This record is in use by other records." };
    if (err.code === "P2025") return { ok: false, error: "Record not found." };
  }
  const message = err instanceof Error ? err.message : String(err);
  // Business rules raised by our own database triggers / CHECK constraints
  // (SQLSTATE 23514 check_violation, 42501 insufficient_privilege) are safe to show.
  const pg = message.match(/PostgresError \{ code: "(23514|42501)", message: "((?:[^"\\]|\\.)*)"/);
  if (pg) return { ok: false, error: friendlyDbMessage(pg[2]) };
  const dbRule = message.match(
    /(permission denied[^\n"]*|[^\n"]*cannot be (?:deleted|modified|changed|moved)[^\n"]*|insufficient stock[^\n"]*|[^\n"]*does not (?:belong|match)[^\n"]*|contract is voided)/,
  );
  if (dbRule) return { ok: false, error: friendlyDbMessage(dbRule[1].trim()) };
  console.error("[action error]", err);
  return { ok: false, error: "Something went wrong. Nothing was saved." };
}

/** Writes an application-level audit entry (for things triggers don't cover, e.g. logins, users). */
export async function writeAudit(
  client: Tx | typeof db,
  entry: { userId: string | null; action: string; entityType: string; entityId?: string | null; before?: unknown; after?: unknown; ip?: string | null },
) {
  await client.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      before: entry.before === undefined ? undefined : (entry.before as Prisma.InputJsonValue),
      after: entry.after === undefined ? undefined : (entry.after as Prisma.InputJsonValue),
      ip: entry.ip ?? null,
    },
  });
}

/** Turns a raw database rule message into a sentence for the user. */
export function friendlyDbMessage(raw: string): string {
  const m = raw.trim();
  if (/violates check constraint "(\w+)_amount_chk"/.test(m)) return "Amount must be greater than zero.";
  if (/violates check constraint "Contract_progress_chk"/.test(m)) return "Progress must be between 0 and 100%.";
  if (/violates check constraint/.test(m)) return "The values entered break a data rule. Please check them.";
  if (/not an active admin|no acting user/.test(m)) return "You do not have permission to perform this action.";
  return m.charAt(0).toUpperCase() + m.slice(1) + (/[.!?]$/.test(m) ? "" : ".");
}

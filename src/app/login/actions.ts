"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { dummyVerify, verifyPassword } from "@/lib/auth/password";
import { clientInfo, createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { writeAudit } from "@/lib/mutation";
import { ipRateLimit } from "@/lib/auth/rate-limit";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const GENERIC_ERROR = "Invalid username or password.";

const schema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(200),
});

export type LoginState = { ok: boolean; error?: string; username?: string } | null;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ username: formData.get("username"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR, username: String(formData.get("username") ?? "") };
  const { username, password } = parsed.data;
  const { ip } = await clientInfo();

  if (!ipRateLimit(ip ?? "unknown")) {
    return { username, ok: false, error: "Too many sign-in attempts. Please wait a few minutes and try again." };
  }

  const user = await db.user.findUnique({ where: { username } });
  if (!user || !user.isActive) {
    await dummyVerify(password);
    await writeAudit(db, { userId: null, action: "LOGIN_FAILED", entityType: "User", entityId: user?.id, after: { username }, ip });
    return { username, ok: false, error: GENERIC_ERROR };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await dummyVerify(password);
    return { username, ok: false, error: `Account temporarily locked after repeated failed attempts. Try again after ${LOCK_MINUTES} minutes.` };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    const failed = user.failedLoginCount + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failed >= MAX_FAILED_ATTEMPTS ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    await writeAudit(db, { userId: user.id, action: "LOGIN_FAILED", entityType: "User", entityId: user.id, ip });
    return { username, ok: false, error: GENERIC_ERROR };
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await createSession(user.id);
  await writeAudit(db, { userId: user.id, action: "LOGIN", entityType: "User", entityId: user.id, ip });
  redirect("/");
}

export async function logoutAction() {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await writeAudit(db, { userId: user.id, action: "LOGOUT", entityType: "User", entityId: user.id });
  redirect("/login");
}

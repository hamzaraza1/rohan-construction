import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "rc_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // absolute lifetime of a session
const IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000; // logged out after 12h of inactivity
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: Role;
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function clientInfo() {
  const h = await headers();
  const ip =
    h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return { ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const { ip, userAgent } = await clientInfo();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: { id: hashToken(token), userId, expiresAt, ip, userAgent },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessionsForUser(userId: string, exceptCurrent = false) {
  let keep: string | undefined;
  if (exceptCurrent) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    keep = token ? hashToken(token) : undefined;
  }
  await db.session.deleteMany({
    where: { userId, ...(keep ? { id: { not: keep } } : {}) },
  });
}

/**
 * Returns the logged-in user for this request, or null.
 * Validated against the database on every request (deactivating a user or
 * changing their role takes effect immediately). Cached per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { select: { id: true, name: true, username: true, role: true, isActive: true } } },
  });
  if (!session) return null;
  const now = Date.now();
  if (
    session.expiresAt.getTime() <= now ||
    now - session.lastSeenAt.getTime() > IDLE_TIMEOUT_MS ||
    !session.user.isActive
  ) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }
  const { id, name, username, role } = session.user;
  return { id, name, username, role };
});

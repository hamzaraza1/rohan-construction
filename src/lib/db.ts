import "server-only";
import { PrismaClient } from "@prisma/client";

/**
 * Two database clients:
 *
 *  - `db`     connects as the owner role. Used ONLY for writes, and only through
 *             `adminMutation()` (financial/business data) or the auth module
 *             (sessions, login counters). Database triggers additionally verify
 *             that the acting user is an active ADMIN.
 *  - `dbRead` connects as a PostgreSQL role that has SELECT privileges only.
 *             Every page/report read goes through it, so a read path can never
 *             modify data even if application code is wrong.
 */
const globalForPrisma = globalThis as unknown as {
  __db?: PrismaClient;
  __dbRead?: PrismaClient;
};

function makeClient(url: string | undefined) {
  if (!url) throw new Error("Database URL is not configured");
  return new PrismaClient({ datasourceUrl: url, log: ["error"] });
}

export const db = globalForPrisma.__db ?? makeClient(process.env.DATABASE_URL);
export const dbRead =
  globalForPrisma.__dbRead ?? makeClient(process.env.DATABASE_READONLY_URL);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__db = db;
  globalForPrisma.__dbRead = dbRead;
}

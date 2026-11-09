import { execSync } from "node:child_process";
import { TEST_DB_URL } from "./env";

/**
 * Brings the TEST database up to date (non-destructive: migrate deploy + grants).
 * Tests create uniquely-named data, so they can run repeatedly on the same database.
 * To start from a clean slate, drop and recreate the test database manually.
 */
export default function setup() {
  if (!/_test\b|_test\?/.test(TEST_DB_URL)) throw new Error("Refusing to run tests against a non-test database");
  const env = { ...process.env, DATABASE_URL: TEST_DB_URL };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  execSync("npx prisma db execute --file prisma/sql/grants.sql --schema prisma/schema.prisma", { env, stdio: "pipe" });
}

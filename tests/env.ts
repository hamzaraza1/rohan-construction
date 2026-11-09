// Test database (never the real one). Override with TEST_DATABASE_URL / TEST_DATABASE_READONLY_URL.
export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://rc_owner:devpass@localhost:5432/rohan_test?schema=public";
export const TEST_DB_READONLY_URL =
  process.env.TEST_DATABASE_READONLY_URL ?? "postgresql://rc_readonly:devro@localhost:5432/rohan_test?schema=public";

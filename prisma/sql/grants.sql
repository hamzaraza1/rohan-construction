-- Read-only database role used for ALL application reads.
-- Run after every `prisma migrate deploy` (npm run db:deploy does this).
-- The role itself is created by deploy/postgres/init-roles.sh (or manually).
GRANT USAGE ON SCHEMA public TO rc_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO rc_readonly;
-- Credentials and sessions are never readable through the read-only role.
REVOKE ALL ON "Session" FROM rc_readonly;
REVOKE ALL ON "User" FROM rc_readonly;
GRANT SELECT ("id", "name", "username", "email", "role", "isActive", "lastLoginAt", "createdAt", "updatedAt")
  ON "User" TO rc_readonly;
REVOKE ALL ON "_prisma_migrations" FROM rc_readonly;

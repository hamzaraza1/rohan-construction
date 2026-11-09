# Phase 1: Foundation (delivered)

## What was built
* **Full database schema** for all modules (`prisma/schema.prisma`) and two migrations:
  * `…_init`: tables, enums, foreign keys, indexes
  * `…_integrity_audit_ledger`: CHECK constraints, admin-only write triggers, actor stamping, no-delete rules, audit trigger, append-only audit log, PO/receipt consistency triggers, negative-stock prevention, ledger and balance views
* **Read-only database role** (`prisma/sql/grants.sql`) used for every read in the app.
* **Authentication:** username + password (Argon2id), database sessions (httpOnly cookie, 7-day absolute and 12-hour idle expiry), account lockout, IP rate limit, sign-in/out and failed attempts recorded in the audit log, change-own-password page.
* **Roles:** ADMIN (Hamza) and VIEWER (partners). Enforced at three levels: Server Actions, database triggers and the read-only DB role.
* **UI system:** sidebar plus mobile drawer, top bar with user menu, cards, tables, badges, form fields, confirmation dialogs, empty states. Currency is shown as Rs. and dates as `09 Nov 2026`.
* **Company dashboard:** reads real figures from the `ProjectFinancialSummary` and `ProjectCashLedger` views (cash summary cards, 12-month cash-flow chart, per-project table, recent transactions). It shows empty states until Phase 2 adds data entry.
* **Settings (admin only):** users (create, change role, deactivate, reset password; the last active admin cannot be removed), partners, expense / material / work / supplier categories (add, rename, reorder, deactivate; delete only when unused; system categories are protected), and an audit log viewer.
* Pages for later phases show an honest "Scheduled for Phase N" notice. No fake data.
* Deployment scaffolding (Dockerfile, compose, Caddy, Postgres role init), backup / restore / restore-test scripts, documentation.

## Local setup (development)

Requirements: Node 22+, PostgreSQL 16 (native, or `docker compose -f docker-compose.dev.yml up -d`).

```bash
npm install
cp .env.example .env              # adjust the passwords to match your database roles
```
Without Docker, create the roles yourself:
```bash
sudo -u postgres psql -c "CREATE ROLE rc_owner LOGIN PASSWORD 'devpass' CREATEDB;" -c "CREATE DATABASE rohan OWNER rc_owner;" -c "CREATE ROLE rc_readonly LOGIN PASSWORD 'devro';"
```
Then:
```bash
npx prisma migrate deploy && npm run db:grants
SEED_ADMIN_PASSWORD='choose-a-long-password' npm run db:seed
npm run dev                        # http://localhost:3000, sign in as "hamza"
```

## How to test
Automated (needs a separate `rohan_test` database owned by `rc_owner`):
```bash
sudo -u postgres psql -c "CREATE DATABASE rohan_test OWNER rc_owner;"
npm test
```
20 tests cover:
* read-only role cannot write or read secrets
* writes rejected with no user, a viewer, or a deactivated admin
* audit rows written with the acting user; audit log cannot be edited
* `createdById` cannot be forged
* financial rows cannot be deleted; void needs a reason; voided rows are frozen
* amount and commission constraints
* the full supplier order → advance → partial deliveries → payment cycle (table in `02-database-and-accounting.md`)
* stock cannot go negative, and consumption does not change cost
* contract commitment vs payments, extras and deductions
* cross-project contractor payment rejected
* cash balance = receipts − outflows − withdrawals; withdrawals are not cost; commission at 10%
* voided rows drop out of balances
* a receipt cannot use another supplier's PO
* Rs. and date formatting

Also run: `npm run typecheck`, `npm run lint`, `npm run build`.

Manual checks (performed with a headless browser during development):
1. Visit `/`: you are redirected to `/login`. A wrong password shows "Invalid username or password." and keeps the username.
2. Sign in as hamza: the company overview appears.
3. Settings → Users: create a read-only user. Settings → Work categories: add "Waterproofing". Settings → Audit log: both changes are listed.
4. Sign in as the read-only user (e.g. in a private window): no Settings link, a "Read-only access" badge, and `/settings/users` shows "Admin access required".
5. On a phone-sized window the ☰ button opens the navigation drawer.

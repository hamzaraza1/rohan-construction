# 3. Implementation plan

The **complete** database schema, constraints, triggers and ledger views were delivered in
Phase 1, so that the accounting model is consistent from day one. Later phases add screens,
server actions and reports on top of it, plus a migration only if a decision in
`04-open-decisions.md` requires a schema change.

| Phase | Scope | Status |
|---|---|---|
| **1. Foundation** | Architecture, full schema + migrations, DB-level permissions/audit/no-delete, authentication, admin + read-only roles, company dashboard, navigation + UI system, Settings (users, partners, all category types, audit log), Docker/Caddy/backup scaffolding, integration tests | **Done** (see `phase-1.md`) |
| **2. Projects & Clients** | Project create/edit/archive for the three contract types, commission % per project, per-project dashboard + cash ledger, client profiles, client payment entry with receipt upload, voiding | **Done** (see `phase-2.md`) |
| **3. Contractors** | Contractor profiles, contracts with included/excluded work scope, advances/installments/final, extras/deductions, progress, balances | **Done** (see `phase-3.md`) |
| 4. Suppliers & Inventory | Supplier profiles, purchase orders, advances, goods receipts (partial deliveries), supplier balances, materials, stock issue/wastage/adjustment, stock valuation | Next |
| 5. Expenses & Partners | Project expenses (incl. Misc. section), bill attachments, partner withdrawals + per-partner history | |
| 6. Reports | Project ledger, client/expense/contractor/supplier/inventory/withdrawal/outstanding/date-wise reports; filters; PDF + Excel export | |
| 7. Testing & deployment | Full functional/permission/security test pass, VPS hardening, HTTPS, Docker deploy, backup + off-site + restore drill | |

Each phase: explanation → working code → migrations (if any) → setup commands → test instructions → regression run of all earlier tests.

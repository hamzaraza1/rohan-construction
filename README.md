# Rohan Construction: Project & Finance ERP

Internal construction project management and financial tracking for Rohan Construction.

## Current stage: Stage 1 (frontend prototype)

| Stage | What | Status |
|---|---|---|
| 1 | Complete interactive frontend with realistic demo data | **Ready for review** |
| 2 | PostgreSQL, Prisma, authentication, permissions, APIs, audit log, file uploads | Waits for frontend approval |
| 3 | Full testing, Docker, Hostinger KVM 2 deployment, HTTPS, backups | After Stage 2 |

Stage 1 has **no database, no backend and no real login**. All data is demo data held in the
browser. Anything you add or change is saved in that browser only (localStorage), so it
survives a refresh. **Settings → General → Reset demo data** restores the original sample data.

## Run it

Requires Node.js 22+.

```bash
npm install
npm run dev          # development, http://localhost:3000
```

Production-style run:

```bash
npm run build
npm start            # http://localhost:3000
```

Sign in with a demo account (any password of 6+ characters):

| Account | Access |
|---|---|
| `hamza@rohanconstruction.pk` | Admin: full access |
| `bilal@rohanconstruction.pk` | Partner: read-only |

You can also switch between admin and partner view from the user menu (top right).

## Checks

```bash
npm run typecheck
npm run lint
E2E_BASE=http://localhost:3000 node e2e-interactions.cjs   # needs the app running
```

`e2e-interactions.cjs` drives the app in a browser (36 checks). Among them:
- form validation
- adding a contractor, project, payment, delivery, expense and withdrawal
- blocking over-consumption of stock
- delete confirmation, sorting, pagination and date filters
- Excel export
- read-only partner view
- mobile navigation

## Modules

- **Dashboard:** company totals, cash flow chart, biggest payables, recent transactions, project summary.
- **Projects:** a single contract type (With Material). Cards and table view. Project page with tabs: overview, transactions, client payments, contractors, suppliers, inventory, expenses, withdrawals.
- **Clients:** profile, projects, payment history.
- **Client payments:** cash, bank transfer and cheque.
- **Contractors:** specialization, contracts with included and excluded scope, extras and deductions, advance / installment / final payments, outstanding balance.
- **Suppliers:** balance per project, delivery (purchase) history, advances and payments, outstanding balance.
- **Inventory:** per-site stock, material receiving, consumption, wastage, movement history, material list.
- **Expenses:** categories, a separate miscellaneous section, receipt attachment, filters.
- **Partner withdrawals:** partner-wise and project-wise history. Withdrawals reduce cash but are not expenses.
- **Reports:**
  - project-wise, cash book, expenses, client payments
  - contractors, suppliers, inventory, partner withdrawals
  - export to Excel (CSV) or print / save as PDF
- **Settings (admin):** users, partners, expense / material / work categories, company settings.

## Accounting rules shown in the prototype

- **Available cash** = client payments − supplier payments − contractor payments − site expenses − partner withdrawals
- **Total expenses** = supplier payments + contractor payments + site expenses. Withdrawals are not expenses.
- **Contract amounts and purchase advances** are commitments or prepayments. Only received material adds stock, and using that stock never adds cost again.
- **Supplier balance** is tracked per project: received value − paid. A negative balance is an advance held by the supplier.

## Code layout

```
src/app/login                 login page
src/app/(app)/…               all signed-in pages (sidebar + topbar layout)
src/components/ui             reusable UI: Button, Card, DataTable, Modal, Tabs, fields…
src/components/forms          all forms (modal and page)
src/components/domain         module tables and widgets
src/components/charts         charts (recharts)
src/lib/mock-data.ts          demo data (deterministic)
src/lib/calculations.ts       every financial formula, in one place
src/lib/store.tsx             in-browser demo store (replaced by the API in Stage 2)
```

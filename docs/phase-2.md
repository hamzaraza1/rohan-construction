# Phase 2: Projects, clients and client payments (delivered)

Built using the default answers in `04-open-decisions.md`.

## What was built

### Projects (`/projects`)
* **List:**
  * search by project, site or client
  * filter by contract type and status
  * archived projects shown separately
  * columns: received, actual cost and cash balance for each project
* **Create / edit:**
  * name, client (with a quick "+ New client" link), site address, status, start date, optional expected completion date, description
  * the **three contract types** are chosen with explained cards:
    * *Commission Based* asks for its own **commission %** (0–100, required; never one fixed value for all projects)
    * *With Material* and *Labour Rate* take an optional **agreed contract value** with the client
  * the client is **locked** once client payments exist (also enforced by the database)
* **Archive / restore:** archiving hides a project from lists, but nothing is deleted and its balances stay intact.

### Per-project dashboard (`/projects/<id>`)
* **Dashboard tab:**
  * received, total actual expenses, partner withdrawals, available cash
  * contractor and supplier payments
  * amounts owed to suppliers (plus undelivered orders) and to contractors (with the contracted total)
  * **commission and client billing:**
    * commission projects: material + contractor + expenses = cost; then commission @ %, billable, received, and the amount still to pay or paid in advance
    * other projects: agreed value − received
  * a cash-paid-out breakdown, recent transactions, and an inventory summary (filled in by Phase 4)
* **Client payments tab:** the payment list with receipt links, **edit**, and **void with a reason**. Voided payments stay visible, struck through, with their reason.
* **Cash ledger tab:** every cash movement with a **running balance**, a date filter, the opening balance before the period, and period totals.

### Clients (`/clients`)
* **List:** search by name, phone or email; projects (active count); total received; amount still to pay.
* **Profile:**
  * contact details and notes
  * totals: received, billable so far, still to pay
  * associated projects with each project's billable / received / still-to-pay figures
  * full payment history across all projects
* **Create, edit, archive and restore.**

### Client payments
* Fields: project (the client comes from the project), amount, date (not in the future), Cash / Bank Transfer, optional reference, description, optional receipt.
* **Amounts:** typed as `2,500,000`, `Rs. 300000` or `1500.50`. They are stored as exact decimals.
* **Corrections:**
  * editing is allowed and audited with before and after values
  * a payment cannot be moved to another project; void it and record it again (enforced by the database)
  * voided payments are frozen

### Receipts and attachments
* Only PDF, JPG, PNG and WEBP up to 10 MB. The type is detected from the **file content**, so an HTML file renamed `.pdf` is rejected.
* Stored under random names in `UPLOAD_DIR`, with a SHA-256 checksum.
* Served only to signed-in users, with `nosniff` and a sandboxing CSP.

### Forms
* Field-level error messages.
* What you typed is kept when validation fails.
* Confirmation dialogs for archive and void.

## Database migration
`prisma/migrations/20261109155957_client_balance_and_stock_views`:
* `ProjectFinancialSummary` gains `clientBillable` and `clientAmountDue`. The amount due is NULL (unknown) when no agreed value exists, so it is never shown as a misleading zero.
* New `ProjectStock` view: stock on hand and value per site and material, at the weighted-average received rate. It feeds the dashboard and Phase 4.
* Triggers:
  * a project's client cannot change after payments exist
  * a client payment cannot be moved to another project

Apply it with:
```bash
npx prisma migrate deploy && npm run db:grants
```

## How to test
```bash
npm test          # 36 tests: 20 from Phase 1 plus 16 new
```
The new tests cover:
* money, percent and date parsing
* file-type detection (rejects HTML, SVG and executables)
* client amount due for agreed-value, unknown-value and commission projects (including a client who has paid ahead)
* client lock, payment move blocked, edits audited with before and after values
* archived projects keep their balances
* stock valuation at the weighted-average rate

End-to-end browser smoke test (uses a running server and **creates real records**, so use a dev database):
```bash
npm run build && npm start
E2E_ADMIN_PASS='…' E2E_VIEWER_USER=partner2 E2E_VIEWER_PASS='…' npm run e2e
```
It runs 21 checks:
* create a client (and confirm the form keeps its values after a validation error)
* create a commission project and check that the % is required
* reject a disguised upload
* record a payment with a receipt and download it
* edit a payment, then void it with a reason
* check the dashboard figures and the ledger
* check the client lock on the edit page, search, and the client profile
* as the read-only partner: no write buttons, receipts can be opened, admin pages are forbidden
* anonymous users cannot fetch receipts

Every page was also checked at phone width for sideways scrolling.

Manual check: create a client, then a *Commission Based* project at 12%. Record a Rs. 1,000,000 bank transfer with a receipt photo. The dashboard shows Rs. 1,000,000 received and available, and "Client has paid in advance Rs. 1,000,000" (no costs yet). Void the payment and every figure returns to zero, while the payment stays listed as *Voided* with its reason. The Audit log shows the INSERT and the VOID.

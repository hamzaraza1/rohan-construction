# Phase 3: Contractors (delivered)

Default for decision D2: contractor payments, including advances, count as project cost when paid.

## What was built

### Contractors (`/contractors`)
* **List:** search by name, phone or specialization; contract count; total contracted; total paid; remaining.
* **Profile:**
  * contact details and specialization
  * totals: contract amounts, payments made, remaining payable, overpaid
  * contract history across projects
  * full payment history
* **Create, edit, archive and restore.** A "+ New" link on the contract form creates a contractor and returns to the form with that contractor selected.

### Contracts (from a project's **Contractors** tab, then `/contracts/<id>`)
* **Fields:** contractor, title, **agreed amount** (a commitment, never cash), start and end dates, status (Active / Completed / Terminated), progress %, and terms.
* **Dynamic work scope:** every work category from *Settings → Work categories* can be marked **Included**, **Excluded** or *Not specified*. Nothing is hard-coded.
* **Contract page:**
  * agreed amount, net payable (with extras and deductions), total paid, and remaining (or overpaid)
  * included and excluded scope lists
  * quick progress and status update
* **Extras and deductions:** dated, with a reason, and voidable. They change what is owed, not cash. A deduction cannot exceed the current net payable.
* **Payments:**
  * Advance / Installment / Final, with method, reference, description and receipt upload
  * edit, and void with a reason
  * **overpayment is blocked** unless "Allow overpayment" is ticked; the contract row is locked so two simultaneous payments cannot both pass the check
  * contractor payments flow automatically into the project cash ledger, dashboard, cash balance and project cost, counted once
* **Void contract:** only allowed when it has no active payments or adjustments.

### Project page
* New **Contractors** tab: total commitments, paid, remaining, and the contract list with progress.

### Other changes
* Database rule messages (SQLSTATE 23514 / 42501) are now shown to the user as readable sentences instead of a generic error.
* **Bug fixed:** `Decimal.isPositive()` returns true for zero. This made a fully balanced contract show "Overpaid Rs. 0". All uses were replaced, and an ESLint rule now forbids `isPositive()`.
* Test builds can use a separate output folder (`NEXT_DIST_DIR=.next-test`), so a running preview is not disturbed.

## Database migration
`prisma/migrations/*_contract_integrity`:
* a contract cannot move to another project
* a payment or adjustment cannot move to another contract
* the contractor on a contract cannot change after payments exist
* a contract with active payments or adjustments cannot be voided

## How to test
```bash
npm test     # 44 tests (8 new for contracts)
```
The new tests cover:
* overpayment shown as "overpaid", never as a negative balance
* the four immutability and void rules above
* a work category cannot appear twice in a contract's scope
* an adjustment is not cash, so only the payment appears in the ledger
* trigger errors become readable messages

Browser end-to-end check (22 checks, against a dev server):
```bash
E2E_ADMIN_PASS='…' E2E_VIEWER_USER=partner2 E2E_VIEWER_PASS='…' node e2e/contractors.cjs
```
The walkthrough follows the requirements example:
1. Create a Rs. 2,500,000 labour contract that **includes** brickwork, plaster, tiles, electrical and plumbing, and **excludes** paint, woodwork and false ceiling.
2. Add a +100,000 extra and a −50,000 deduction. Net payable is 2,550,000.
3. Pay a 500,000 advance and a 700,000 installment. Paid is 1,200,000; remaining is 1,350,000.
4. An overpayment is blocked.
5. Void the installment. Paid drops back to 500,000.
6. Check the project: contractor payments 500,000, cash −500,000, and 2,050,000 owed to contractors, with exactly one ledger row.
7. Check the contractor profile totals.
8. The read-only partner has no write controls.
9. No sideways scrolling at phone width.

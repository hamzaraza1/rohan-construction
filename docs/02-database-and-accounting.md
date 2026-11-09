# 2. Database schema and accounting model

Business logic and accounting accuracy come first. This document explains the accounting
problems in the requirements and how the schema avoids them. The source of truth is
`prisma/schema.prisma`, plus the SQL in `prisma/migrations/*_integrity_audit_ledger/migration.sql`.

## 2.1 Accounting problems found in the requirements, and how they are solved

| # | Risk | Resolution |
|---|---|---|
| 1 | **The same money counted twice.** The default expense categories include *Material Purchase* and *Contractor Payment*, and suppliers and contractors also have their own payment modules. If a supplier payment is also entered as an expense, it is counted twice. | Cash leaves a project through exactly **five** tables: `ClientPayment` (in), `SupplierPayment`, `ContractorPayment`, `Expense`, `PartnerWithdrawal` (out). The *Contractor Payment* expense category is a **system category**: you cannot enter expenses in it by hand, and reports fill it from `ContractorPayment`. Supplier payments are recorded only in the Suppliers module. *Material Purchase* in Expenses is for small cash purchases from walk-in shops that are not kept in inventory (see decision D1). |
| 2 | **An advance treated as received material.** | Only `MaterialReceipt` lines add stock and count as material cost. `SupplierPayment` only settles the supplier's account. The advance balance and the amount owed are calculated from the difference between them, per project and supplier. |
| 3 | **A purchase order treated as spending.** | `PurchaseOrder` and its lines are commitments. They feed *undelivered order value* only and never touch cash or cost. |
| 4 | **A contract amount treated as paid.** | `Contract.contractAmount` is a commitment. Only `ContractorPayment` moves cash. Extras and deductions (`ContractAdjustment`) change what is owed, not cash. |
| 5 | **Material counted again when it is used.** | Material cost is counted **once, when it is received**. Issuing material (`StockMovement` ISSUE/WASTAGE) only reduces stock quantity and value. It is never added to cost or cash. |
| 6 | **Partner withdrawals counted as expenses.** | `PartnerWithdrawal` reduces cash but is excluded from project cost and expense reports. |
| 7 | **Payments booked to the wrong project.** | Every financial row has a `projectId`. A `ContractorPayment` has a composite foreign key `(contractId, projectId)` to the contract, so it cannot be posted to a different project. Triggers check that a receipt or payment linked to a purchase order has the same project and supplier, and that a receipt line matches its order line. |
| 8 | **Financial records lost by accidental deletion.** | DELETE is blocked by a trigger. Records are voided with a reason, and everything is audited. |
| 9 | **Floating-point rounding errors.** | All amounts are `NUMERIC(14,2)` and quantities are `NUMERIC(14,3)`. All sums are done in SQL. |
| 10 | **Figures computed differently on different screens.** | All headline figures come from SQL **views**, so every screen and report uses the same formula. |

## 2.2 Core formulas (view `ProjectFinancialSummary`)

```
cashBalance  = clientReceipts
             − supplierPayments − contractorPayments − directExpenses
             − partnerWithdrawals

projectCost  = materialReceivedValue + contractorPayments + directExpenses
               (supplier payments are NOT added: material was already costed on receipt;
                partner withdrawals are drawings, not cost)

commission   = projectCost × commissionPercent / 100       (COMMISSION projects only)

supplier account (per project + supplier, view SupplierAccount):
  orderedValue       = Σ PO lines (not cancelled)
  receivedValue      = Σ receipt lines (not voided)
  paid               = Σ supplier payments (not voided)
  advanceBalance     = max(paid − receivedValue, 0)
  outstandingPayable = max(receivedValue − paid, 0)
  undeliveredValue   = Σ over OPEN PO lines of max(ordered − received qty, 0) × rate

contract (view ContractBalance):
  netPayable  = contractAmount + extras − deductions
  outstanding = max(netPayable − paid, 0);   overpaid = max(paid − netPayable, 0)

stock on hand (function app_stock_on_hand) = received − issued − wasted ± adjustments
  (a deferred constraint trigger rejects anything that would make stock negative)
```

Worked example from the requirements (verified in `tests/ledger.test.ts`):

| Step | Cash balance | Material received | Advance balance | Owed to supplier | Undelivered |
|---|---|---|---|---|---|
| Order Rs. 500,000 | 0 | 0 | 0 | 0 | 500,000 |
| Pay advance Rs. 300,000 | −300,000 | 0 | 300,000 | 0 | 500,000 |
| Receive Rs. 200,000 | −300,000 | 200,000 | 100,000 | 0 | 300,000 |
| Receive Rs. 250,000 | −300,000 | 450,000 | 0 | 150,000 | 50,000 |
| Pay Rs. 150,000 | −450,000 | 450,000 | 0 | 0 | 50,000 |

## 2.3 Tables and relationships

```
User 1─* Session          User 1─0..1 Partner 1─* PartnerWithdrawal *─1 Project
Client 1─* Project
Project 1─* ClientPayment
Project 1─* Contract *─1 Contractor
        Contract 1─* ContractScopeItem *─1 WorkCategory   (included = true/false)
        Contract 1─* ContractAdjustment                   (EXTRA / DEDUCTION)
        Contract 1─* ContractorPayment  (FK (contractId, projectId))
Project 1─* PurchaseOrder *─1 Supplier ;  PurchaseOrder 1─* PurchaseOrderLine *─1 Material
Project 1─* MaterialReceipt *─1 Supplier (optional PO) ; MaterialReceipt 1─* MaterialReceiptLine (optional PO line)
Project 1─* SupplierPayment *─1 Supplier (optional PO; type ADVANCE / PAYMENT)
Project 1─* StockMovement *─1 Material     (ISSUE / WASTAGE / ADJUSTMENT)
Project 1─* Expense *─1 ExpenseCategory
Material *─1 MaterialCategory ;  Supplier *─* SupplierCategory
Attachment ← referenced by ClientPayment, ContractorPayment, SupplierPayment, MaterialReceipt, Expense
AuditLog (append-only), AppSetting (key/value)
```

| Table | Purpose / key fields |
|---|---|
| `User` | username, Argon2id `passwordHash`, `role` ADMIN/VIEWER, `isActive`, lockout counters |
| `Session` | id = SHA-256(cookie token), expiry, last seen, IP, user agent |
| `Partner` | partner name (configurable), optional link to a login |
| `ExpenseCategory` | `systemKey` (system category), `isMiscellaneous` (separate Misc. section), `isActive` |
| `MaterialCategory`, `WorkCategory`, `SupplierCategory` | configurable lists; deactivate instead of deleting once used |
| `Client` | name, phone, email?, address?; archived instead of deleted |
| `Project` | client, site address, `type` (WITH_MATERIAL / LABOUR_RATE / COMMISSION), status, dates, `commissionPercent` (required **only** for COMMISSION, 0–100), optional `clientContractAmount` |
| `ClientPayment` | project, amount, date, method (CASH / BANK_TRANSFER), reference, description, attachment. The client is taken from the project, so it cannot disagree with it. |
| `Contractor`, `Contract`, `ContractScopeItem`, `ContractAdjustment`, `ContractorPayment` | contractor module (payment type ADVANCE / INSTALLMENT / FINAL) |
| `Supplier`, `PurchaseOrder(+Line)`, `MaterialReceipt(+Line)`, `SupplierPayment` | supplier cycle: order, then receive, then pay |
| `Material`, `StockMovement` | per-site inventory. Stock in comes from receipts. Issue, wastage and adjustments are recorded here. |
| `Expense` | project, category, amount, date, paid to, method, description, attachment |
| `PartnerWithdrawal` | partner, project, amount, date, method, description |
| `Attachment` | stored name (random), original name, MIME type, size, SHA-256 |
| `AuditLog` | user, action (INSERT/UPDATE/VOID/DELETE/LOGIN/…), entity, before/after JSON |

Common columns on financial tables: `createdById`, `updatedById`, `voidedAt`, `voidedById`, `voidReason`, `createdAt`, `updatedAt`.

### Views
`ProjectCashLedger` (all cash movements), `ContractBalance`, `PurchaseOrderLineBalance`,
`SupplierAccount`, `ProjectFinancialSummary`. Voided rows are excluded everywhere.

### Integrity rules enforced by the database
* Amounts > 0; contract amount ≥ 0; quantities > 0; progress 0–100; end dates ≥ start dates.
* Commission % present only, and always, for commission projects.
* A voided record needs a reason, cannot be modified afterwards, and cannot be inserted already voided.
* No DELETE on financial tables, projects, clients, contractors, suppliers or purchase orders.
* Only an active ADMIN (as `app.user_id`) can write to business tables.
* No negative stock, whether from an issue or from voiding a receipt.

# Phase 4: Suppliers and inventory (delivered)

Default for decision D1: a walk-in cash purchase is recorded as a **receipt marked "Paid in full on delivery"**. This adds the material to stock and records the payment in one step.

## The supplier cycle, and what each step does

| Step | Screen | Cash | Project cost | Stock | Supplier balance |
|---|---|---|---|---|---|
| Purchase order | *New purchase order* | — | — | — | adds to **undelivered** |
| Advance payment | *Pay supplier* (type Advance) | **−** | — | — | **advance balance** goes up |
| Material received | *Receive material* | — | **+ value** | **+ qty** | advance is used up first, then **payable** |
| Payment against delivery | *Pay supplier* (type Payment) | **−** | — | — | payable goes down |
| Issue / wastage | Project → Inventory | — | — (already counted on receipt) | **− qty** | — |
| Close order | Purchase order page | — | — | — | undelivered released |

Each amount is counted once. Advances are never treated as material, purchase orders never move cash, and using material never adds cost a second time.

## What was built
* **Suppliers** (`/suppliers`):
  * list with search (including by material category) showing received, paid, advance balance and payable
  * create, edit, archive; material categories are picked as checkboxes
  * **profile**: the six required figures (order value, material received, total paid, advance balance, outstanding payable, undelivered orders), balances **per project**, purchase orders, deliveries and payment history
* **Materials catalogue** (`/inventory/materials`):
  * add and edit name, unit, category and active flag
  * a material's unit is locked once the material is used
* **Purchase orders**:
  * multi-line orders (material, quantity, rate) with live totals
  * a "+ New" supplier link that returns to the form
  * order page shows ordered, received and remaining quantity per line
  * actions: **Receive material**, **Pay supplier**, **Close** (releases the undelivered value), **Reopen**, **Cancel** (only before any delivery or payment)
  * edit is allowed only until the first delivery
* **Material receipts**:
  * from an order, lines are pre-filled with the remaining quantities; receiving more than ordered is blocked unless confirmed
  * direct receipts without an order are also supported
  * optional challan number and attachment
  * "**Paid in full on delivery**" option for cash purchases
  * receipts cannot be edited; a wrong receipt is voided with a reason (refused if the material has already been issued)
* **Supplier payments**:
  * Advance or Payment, optionally linked to an order
  * the form shows the account position and pre-fills the payable amount
  * receipt attachment; edit; void with a reason
* **Inventory**:
  * `/inventory` shows the stock value of every site
  * each project's **Inventory** tab shows, per material: purchased (ordered), received, issued, wastage, corrections, in stock, average rate and stock value
  * record **issue**, **wastage** or **stock-count correction**; a correction must have a reason
  * stock can never go negative; this is enforced in the database
  * usage history with void
* **Project page**: new **Suppliers** and **Inventory** tabs; the dashboard inventory card now links to the site stock.

## Database migration
`prisma/migrations/*_purchasing_inventory_integrity`:
* the project, supplier and order of a payment or receipt, and the project and material of a stock movement, can no longer be changed after entry
* receipt lines are frozen
* material can only be received against an **open** order
* order lines are locked after the first delivery
* an order with activity cannot be cancelled (close it instead), and a cancelled order cannot be reopened
* a material's unit is locked once used

## How to test
```bash
npm test      # 53 tests (9 new for purchasing/inventory)
E2E_ADMIN_PASS='…' E2E_VIEWER_USER=partner2 E2E_VIEWER_PASS='…' node e2e/suppliers.cjs   # 28 checks
```
The browser test follows the requirements example exactly:

| Step | Expected result |
|---|---|
| Order 1,000 bags @ Rs. 500 (Rs. 500,000) | no cash moved, no material received |
| Rs. 300,000 advance | advance balance 300,000, material 0 |
| Receive 400 bags | received 200,000 · advance 100,000 · payable 0 · undelivered 300,000 |
| Receive 500 bags | received 450,000 · advance 0 · payable 150,000 · undelivered 50,000 |
| Try to receive 200 more | blocked (only 100 remain on the order) |
| Pay 150,000 (pre-filled) and close the order | payable 0 · undelivered 0 |
| Issue 600 bags, try 400 more, record 10 wastage | over-issue blocked; 290 bags left, worth Rs. 145,000 |

The project then shows **total actual expenses Rs. 450,000** (material is not counted again for the payment or the issue) and **cash −Rs. 450,000**. A cash purchase of 10 bags adds Rs. 5,200 to material received with nothing left owing. The read-only partner sees no write controls, and there is no sideways scrolling at phone width.

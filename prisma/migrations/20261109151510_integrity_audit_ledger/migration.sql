-- =============================================================================
-- Integrity, permission enforcement, audit trail and ledger views.
--
-- Prisma does not model CHECK constraints, triggers or views, so they live in
-- this hand-written migration. They are the last line of defence: even if the
-- application had a bug, the database refuses invalid financial data,
-- non-admin writes and hard deletes of financial records.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CHECK constraints
-- -----------------------------------------------------------------------------

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_commission_chk" CHECK (
    ("type" = 'COMMISSION' AND "commissionPercent" IS NOT NULL
       AND "commissionPercent" > 0 AND "commissionPercent" <= 100)
    OR ("type" <> 'COMMISSION' AND "commissionPercent" IS NULL)
  ),
  ADD CONSTRAINT "Project_clientContractAmount_chk" CHECK ("clientContractAmount" IS NULL OR "clientContractAmount" >= 0),
  ADD CONSTRAINT "Project_dates_chk" CHECK ("expectedCompletionDate" IS NULL OR "expectedCompletionDate" >= "startDate"),
  ADD CONSTRAINT "Project_name_chk" CHECK (length(btrim("name")) > 0);

ALTER TABLE "Client"      ADD CONSTRAINT "Client_name_chk"     CHECK (length(btrim("name")) > 0);
ALTER TABLE "Contractor"  ADD CONSTRAINT "Contractor_name_chk" CHECK (length(btrim("name")) > 0);
ALTER TABLE "Supplier"    ADD CONSTRAINT "Supplier_name_chk"   CHECK (length(btrim("name")) > 0);

ALTER TABLE "Contract"
  ADD CONSTRAINT "Contract_amount_chk"   CHECK ("contractAmount" >= 0),
  ADD CONSTRAINT "Contract_progress_chk" CHECK ("progressPercent" BETWEEN 0 AND 100),
  ADD CONSTRAINT "Contract_dates_chk"    CHECK ("endDate" IS NULL OR "endDate" >= "startDate");

ALTER TABLE "ClientPayment"      ADD CONSTRAINT "ClientPayment_amount_chk"      CHECK ("amount" > 0);
ALTER TABLE "ContractAdjustment" ADD CONSTRAINT "ContractAdjustment_amount_chk" CHECK ("amount" > 0);
ALTER TABLE "ContractorPayment"  ADD CONSTRAINT "ContractorPayment_amount_chk"  CHECK ("amount" > 0);
ALTER TABLE "SupplierPayment"    ADD CONSTRAINT "SupplierPayment_amount_chk"    CHECK ("amount" > 0);
ALTER TABLE "Expense"            ADD CONSTRAINT "Expense_amount_chk"            CHECK ("amount" > 0);
ALTER TABLE "PartnerWithdrawal"  ADD CONSTRAINT "PartnerWithdrawal_amount_chk"  CHECK ("amount" > 0);

ALTER TABLE "PurchaseOrderLine"
  ADD CONSTRAINT "PurchaseOrderLine_qty_chk"  CHECK ("quantity" > 0),
  ADD CONSTRAINT "PurchaseOrderLine_rate_chk" CHECK ("rate" >= 0);
ALTER TABLE "MaterialReceiptLine"
  ADD CONSTRAINT "MaterialReceiptLine_qty_chk"  CHECK ("quantity" > 0),
  ADD CONSTRAINT "MaterialReceiptLine_rate_chk" CHECK ("rate" >= 0);

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_qty_chk" CHECK (
    ("type" IN ('ISSUE', 'WASTAGE') AND "quantity" > 0)
    OR ("type" = 'ADJUSTMENT' AND "quantity" <> 0)
  );

-- A voided record must carry a reason.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ClientPayment','Contract','ContractAdjustment','ContractorPayment',
                           'MaterialReceipt','SupplierPayment','StockMovement','Expense','PartnerWithdrawal']
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK ("voidedAt" IS NULL OR length(btrim(coalesce("voidReason", ''''))) > 0)',
      t, t || '_void_reason_chk');
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Acting user + admin enforcement
--
-- The application opens a transaction and runs
--     SELECT set_config('app.user_id', '<user id>', true)
-- before writing. Every write to a business table checks that this user exists,
-- is active and is an ADMIN. A PostgreSQL superuser (maintenance) is allowed.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')
$$;

CREATE OR REPLACE FUNCTION app_is_superuser() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT rolsuper FROM pg_roles WHERE rolname = session_user), false)
$$;

CREATE OR REPLACE FUNCTION app_require_admin() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE uid text := app_current_user_id();
BEGIN
  IF app_is_superuser() THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'permission denied: no acting user for write to %', TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = uid AND "role" = 'ADMIN' AND "isActive") THEN
    RAISE EXCEPTION 'permission denied: user % is not an active admin', uid
      USING ERRCODE = '42501';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;

-- Stamps createdById / updatedById / voidedById from the acting user so they can
-- never be forged by the client, and freezes voided records.
CREATE OR REPLACE FUNCTION app_stamp_actor() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE uid text := app_current_user_id();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF uid IS NOT NULL THEN NEW."createdById" := uid; END IF;
    NEW."updatedById" := NULL;
    IF NEW."voidedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'cannot insert an already voided record' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF OLD."voidedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'voided % records cannot be modified', TG_TABLE_NAME USING ERRCODE = '23514';
    END IF;
    NEW."createdById" := OLD."createdById";
    NEW."createdAt"   := OLD."createdAt";
    IF uid IS NOT NULL THEN NEW."updatedById" := uid; END IF;
    IF NEW."voidedAt" IS NOT NULL THEN
      NEW."voidedById" := coalesce(uid, NEW."voidedById");
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION app_forbid_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% records cannot be deleted; void them instead', TG_TABLE_NAME
    USING ERRCODE = '42501';
END $$;

-- -----------------------------------------------------------------------------
-- 3. Audit trail: every INSERT/UPDATE/DELETE on business tables is recorded
--    with the full before/after row. AuditLog itself is append-only.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_audit() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  old_row jsonb := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END;
  new_row jsonb := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END;
  action  text  := TG_OP;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF old_row = new_row THEN RETURN NULL; END IF;
    IF (old_row ->> 'voidedAt') IS NULL AND (new_row ->> 'voidedAt') IS NOT NULL THEN
      action := 'VOID';
    END IF;
  END IF;
  INSERT INTO "AuditLog" ("userId", "action", "entityType", "entityId", "before", "after", "createdAt")
  VALUES (
    app_current_user_id(),
    action,
    TG_TABLE_NAME,
    coalesce(new_row ->> 'id', old_row ->> 'id', new_row ->> 'key', old_row ->> 'key'),
    old_row,
    new_row,
    now()
  );
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION app_audit_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only' USING ERRCODE = '42501';
END $$;

CREATE TRIGGER "AuditLog_immutable"
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION app_audit_immutable();

-- Attach triggers.
DO $$
DECLARE t text;
BEGIN
  -- All business tables: admin-only writes + audit.
  FOREACH t IN ARRAY ARRAY[
    'Partner','AppSetting','ExpenseCategory','MaterialCategory','WorkCategory','SupplierCategory',
    'Attachment','Client','Project','ClientPayment','Contractor','Contract','ContractScopeItem',
    'ContractAdjustment','ContractorPayment','Supplier','_SupplierToSupplierCategory','Material',
    'PurchaseOrder','PurchaseOrderLine','MaterialReceipt','MaterialReceiptLine','SupplierPayment',
    'StockMovement','Expense','PartnerWithdrawal']
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON %I
                    FOR EACH ROW EXECUTE FUNCTION app_require_admin()', t || '_00_require_admin', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I
                    FOR EACH ROW EXECUTE FUNCTION app_audit()', t || '_99_audit', t);
  END LOOP;

  -- Financial records: actor stamping + never hard-deleted.
  FOREACH t IN ARRAY ARRAY['ClientPayment','Contract','ContractAdjustment','ContractorPayment',
                           'MaterialReceipt','SupplierPayment','StockMovement','Expense','PartnerWithdrawal']
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION app_stamp_actor()', t || '_10_stamp_actor', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON %I
                    FOR EACH ROW EXECUTE FUNCTION app_forbid_delete()', t || '_05_forbid_delete', t);
  END LOOP;

  -- Purchase orders are cancelled/closed via status, never deleted.
  EXECUTE 'CREATE TRIGGER "PurchaseOrder_05_forbid_delete" BEFORE DELETE ON "PurchaseOrder"
           FOR EACH ROW EXECUTE FUNCTION app_forbid_delete()';
  -- Projects, clients, contractors and suppliers are archived, never deleted.
  FOREACH t IN ARRAY ARRAY['Project','Client','Contractor','Supplier']
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON %I
                    FOR EACH ROW EXECUTE FUNCTION app_forbid_delete()', t || '_05_forbid_delete', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Cross-record consistency
-- -----------------------------------------------------------------------------

-- A receipt / supplier payment linked to a PO must match its project + supplier.
CREATE OR REPLACE FUNCTION app_check_po_link() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."purchaseOrderId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "PurchaseOrder" po
    WHERE po."id" = NEW."purchaseOrderId"
      AND po."projectId" = NEW."projectId"
      AND po."supplierId" = NEW."supplierId"
  ) THEN
    RAISE EXCEPTION 'purchase order does not belong to the same project and supplier'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "MaterialReceipt_20_po_link" BEFORE INSERT OR UPDATE ON "MaterialReceipt"
  FOR EACH ROW EXECUTE FUNCTION app_check_po_link();
CREATE TRIGGER "SupplierPayment_20_po_link" BEFORE INSERT OR UPDATE ON "SupplierPayment"
  FOR EACH ROW EXECUTE FUNCTION app_check_po_link();

-- A receipt line linked to a PO line must belong to the receipt's PO and be
-- the same material.
CREATE OR REPLACE FUNCTION app_check_receipt_line() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."poLineId" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "PurchaseOrderLine" pol
    JOIN "MaterialReceipt" mr ON mr."id" = NEW."receiptId"
    WHERE pol."id" = NEW."poLineId"
      AND pol."purchaseOrderId" = mr."purchaseOrderId"
      AND pol."materialId" = NEW."materialId"
  ) THEN
    RAISE EXCEPTION 'receipt line does not match the purchase order line'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "MaterialReceiptLine_20_check" BEFORE INSERT OR UPDATE ON "MaterialReceiptLine"
  FOR EACH ROW EXECUTE FUNCTION app_check_receipt_line();

-- Contractor payments may only go against non-voided contracts.
CREATE OR REPLACE FUNCTION app_check_contract_active() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."voidedAt" IS NULL AND EXISTS (
    SELECT 1 FROM "Contract" c WHERE c."id" = NEW."contractId" AND c."voidedAt" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'contract is voided' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "ContractorPayment_20_contract_active" BEFORE INSERT OR UPDATE ON "ContractorPayment"
  FOR EACH ROW EXECUTE FUNCTION app_check_contract_active();
CREATE TRIGGER "ContractAdjustment_20_contract_active" BEFORE INSERT OR UPDATE ON "ContractAdjustment"
  FOR EACH ROW EXECUTE FUNCTION app_check_contract_active();

-- -----------------------------------------------------------------------------
-- 5. Inventory: stock on hand per project + material, and no negative stock.
--    Stock IN  = non-voided receipt lines
--    Stock OUT = non-voided ISSUE / WASTAGE; ADJUSTMENT is signed
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_stock_on_hand(p_project text, p_material text) RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT
    coalesce((SELECT sum(l."quantity")
              FROM "MaterialReceiptLine" l
              JOIN "MaterialReceipt" r ON r."id" = l."receiptId"
              WHERE r."projectId" = p_project AND l."materialId" = p_material
                AND r."voidedAt" IS NULL), 0)
  - coalesce((SELECT sum(CASE WHEN m."type" = 'ADJUSTMENT' THEN -m."quantity" ELSE m."quantity" END)
              FROM "StockMovement" m
              WHERE m."projectId" = p_project AND m."materialId" = p_material
                AND m."voidedAt" IS NULL), 0)
$$;

CREATE OR REPLACE FUNCTION app_check_stock() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Serialise stock changes for this project/material.
  PERFORM pg_advisory_xact_lock(hashtext(NEW."projectId" || ':' || NEW."materialId"));
  IF app_stock_on_hand(NEW."projectId", NEW."materialId") < 0 THEN
    RAISE EXCEPTION 'insufficient stock: this entry would make stock negative'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER "StockMovement_30_no_negative_stock"
  AFTER INSERT OR UPDATE ON "StockMovement"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION app_check_stock();

-- Voiding/editing a receipt must not leave already-issued stock negative.
CREATE OR REPLACE FUNCTION app_check_stock_after_receipt() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE mat record;
BEGIN
  FOR mat IN
    SELECT DISTINCT l."materialId" FROM "MaterialReceiptLine" l WHERE l."receiptId" = NEW."id"
  LOOP
    IF app_stock_on_hand(NEW."projectId", mat."materialId") < 0 THEN
      RAISE EXCEPTION 'cannot void/change receipt: material already issued would make stock negative'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER "MaterialReceipt_30_no_negative_stock"
  AFTER UPDATE ON "MaterialReceipt"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION app_check_stock_after_receipt();

-- -----------------------------------------------------------------------------
-- 6. Ledger and balance views — the single source of truth for figures.
--    Voided rows are excluded everywhere.
-- -----------------------------------------------------------------------------

-- Every actual movement of money for a project. Nothing else moves cash.
CREATE VIEW "ProjectCashLedger" AS
  SELECT 'CLIENT_PAYMENT'::text AS "sourceType", cp."id" AS "sourceId", cp."projectId",
         cp."date", cp."method"::text AS "method",
         cp."amount" AS "inflow", 0::numeric(14,2) AS "outflow",
         c."name" AS "counterparty", cp."description", cp."reference", cp."createdAt"
  FROM "ClientPayment" cp
  JOIN "Project" p ON p."id" = cp."projectId"
  JOIN "Client" c  ON c."id" = p."clientId"
  WHERE cp."voidedAt" IS NULL
UNION ALL
  SELECT 'SUPPLIER_PAYMENT', sp."id", sp."projectId", sp."date", sp."method"::text,
         0, sp."amount", s."name", sp."description", sp."reference", sp."createdAt"
  FROM "SupplierPayment" sp
  JOIN "Supplier" s ON s."id" = sp."supplierId"
  WHERE sp."voidedAt" IS NULL
UNION ALL
  SELECT 'CONTRACTOR_PAYMENT', cpay."id", cpay."projectId", cpay."date", cpay."method"::text,
         0, cpay."amount", ctr."name", cpay."description", cpay."reference", cpay."createdAt"
  FROM "ContractorPayment" cpay
  JOIN "Contract" k    ON k."id" = cpay."contractId"
  JOIN "Contractor" ctr ON ctr."id" = k."contractorId"
  WHERE cpay."voidedAt" IS NULL
UNION ALL
  SELECT 'EXPENSE', e."id", e."projectId", e."date", e."method"::text,
         0, e."amount", e."paidTo", e."description", NULL, e."createdAt"
  FROM "Expense" e
  WHERE e."voidedAt" IS NULL
UNION ALL
  SELECT 'PARTNER_WITHDRAWAL', w."id", w."projectId", w."date", w."method"::text,
         0, w."amount", pa."name", w."description", NULL, w."createdAt"
  FROM "PartnerWithdrawal" w
  JOIN "Partner" pa ON pa."id" = w."partnerId"
  WHERE w."voidedAt" IS NULL;

-- Per contract: commitment vs paid. Overpayment shows as contractor advance.
CREATE VIEW "ContractBalance" AS
  SELECT k."id" AS "contractId", k."projectId", k."contractorId", k."status"::text AS "status",
         k."contractAmount",
         coalesce(adj."extras", 0)     AS "extras",
         coalesce(adj."deductions", 0) AS "deductions",
         k."contractAmount" + coalesce(adj."extras", 0) - coalesce(adj."deductions", 0) AS "netPayable",
         coalesce(pay."paid", 0) AS "paid",
         greatest(k."contractAmount" + coalesce(adj."extras", 0) - coalesce(adj."deductions", 0)
                  - coalesce(pay."paid", 0), 0) AS "outstanding",
         greatest(coalesce(pay."paid", 0)
                  - (k."contractAmount" + coalesce(adj."extras", 0) - coalesce(adj."deductions", 0)), 0) AS "overpaid"
  FROM "Contract" k
  LEFT JOIN (
    SELECT "contractId",
           sum(CASE WHEN "type" = 'EXTRA' THEN "amount" ELSE 0 END)     AS "extras",
           sum(CASE WHEN "type" = 'DEDUCTION' THEN "amount" ELSE 0 END) AS "deductions"
    FROM "ContractAdjustment" WHERE "voidedAt" IS NULL GROUP BY "contractId"
  ) adj ON adj."contractId" = k."id"
  LEFT JOIN (
    SELECT "contractId", sum("amount") AS "paid"
    FROM "ContractorPayment" WHERE "voidedAt" IS NULL GROUP BY "contractId"
  ) pay ON pay."contractId" = k."id"
  WHERE k."voidedAt" IS NULL;

-- Per purchase-order line: ordered vs received, and what is still undelivered.
CREATE VIEW "PurchaseOrderLineBalance" AS
  SELECT pol."id" AS "poLineId", po."id" AS "purchaseOrderId", po."projectId", po."supplierId",
         pol."materialId", po."status"::text AS "status",
         pol."quantity" AS "orderedQty", pol."rate",
         round(pol."quantity" * pol."rate", 2) AS "orderedValue",
         coalesce(rcv."qty", 0)   AS "receivedQty",
         coalesce(rcv."value", 0) AS "receivedValue",
         CASE WHEN po."status" = 'OPEN'
              THEN round(greatest(pol."quantity" - coalesce(rcv."qty", 0), 0) * pol."rate", 2)
              ELSE 0 END AS "undeliveredValue"
  FROM "PurchaseOrderLine" pol
  JOIN "PurchaseOrder" po ON po."id" = pol."purchaseOrderId"
  LEFT JOIN (
    SELECT l."poLineId", sum(l."quantity") AS "qty", sum(round(l."quantity" * l."rate", 2)) AS "value"
    FROM "MaterialReceiptLine" l
    JOIN "MaterialReceipt" r ON r."id" = l."receiptId"
    WHERE r."voidedAt" IS NULL AND l."poLineId" IS NOT NULL
    GROUP BY l."poLineId"
  ) rcv ON rcv."poLineId" = pol."id"
  WHERE po."status" <> 'CANCELLED';

-- Per project + supplier account. Advances never count as material received.
CREATE VIEW "SupplierAccount" AS
  WITH keys AS (
    SELECT "projectId", "supplierId" FROM "PurchaseOrder" WHERE "status" <> 'CANCELLED'
    UNION SELECT "projectId", "supplierId" FROM "MaterialReceipt" WHERE "voidedAt" IS NULL
    UNION SELECT "projectId", "supplierId" FROM "SupplierPayment" WHERE "voidedAt" IS NULL
  ),
  ordered AS (
    SELECT "projectId", "supplierId", sum("orderedValue") AS "orderedValue",
           sum("undeliveredValue") AS "undeliveredValue"
    FROM "PurchaseOrderLineBalance" GROUP BY "projectId", "supplierId"
  ),
  received AS (
    SELECT r."projectId", r."supplierId", sum(round(l."quantity" * l."rate", 2)) AS "receivedValue"
    FROM "MaterialReceipt" r JOIN "MaterialReceiptLine" l ON l."receiptId" = r."id"
    WHERE r."voidedAt" IS NULL GROUP BY r."projectId", r."supplierId"
  ),
  paid AS (
    SELECT "projectId", "supplierId", sum("amount") AS "paid"
    FROM "SupplierPayment" WHERE "voidedAt" IS NULL GROUP BY "projectId", "supplierId"
  )
  SELECT k."projectId", k."supplierId",
         coalesce(o."orderedValue", 0)     AS "orderedValue",
         coalesce(r."receivedValue", 0)    AS "receivedValue",
         coalesce(p."paid", 0)             AS "paid",
         greatest(coalesce(p."paid", 0) - coalesce(r."receivedValue", 0), 0) AS "advanceBalance",
         greatest(coalesce(r."receivedValue", 0) - coalesce(p."paid", 0), 0) AS "outstandingPayable",
         coalesce(o."undeliveredValue", 0) AS "undeliveredValue"
  FROM keys k
  LEFT JOIN ordered  o ON o."projectId" = k."projectId" AND o."supplierId" = k."supplierId"
  LEFT JOIN received r ON r."projectId" = k."projectId" AND r."supplierId" = k."supplierId"
  LEFT JOIN paid     p ON p."projectId" = k."projectId" AND p."supplierId" = k."supplierId";

-- One row per project with every headline figure, each computed once.
--   cashBalance  = clientReceipts - supplierPayments - contractorPayments
--                  - directExpenses - partnerWithdrawals
--   projectCost  = materialReceivedValue + contractorPayments + directExpenses
--                  (supplier payments are NOT added: material cost is counted
--                   on receipt, the payment only settles the liability;
--                   partner withdrawals are drawings, not cost)
CREATE VIEW "ProjectFinancialSummary" AS
  WITH cash AS (
    SELECT "projectId",
      sum(CASE WHEN "sourceType" = 'CLIENT_PAYMENT'     THEN "inflow"  ELSE 0 END) AS "clientReceipts",
      sum(CASE WHEN "sourceType" = 'SUPPLIER_PAYMENT'   THEN "outflow" ELSE 0 END) AS "supplierPayments",
      sum(CASE WHEN "sourceType" = 'CONTRACTOR_PAYMENT' THEN "outflow" ELSE 0 END) AS "contractorPayments",
      sum(CASE WHEN "sourceType" = 'EXPENSE'            THEN "outflow" ELSE 0 END) AS "directExpenses",
      sum(CASE WHEN "sourceType" = 'PARTNER_WITHDRAWAL' THEN "outflow" ELSE 0 END) AS "partnerWithdrawals"
    FROM "ProjectCashLedger" GROUP BY "projectId"
  ),
  sup AS (
    SELECT "projectId", sum("receivedValue") AS "materialReceivedValue",
           sum("outstandingPayable") AS "supplierOutstanding",
           sum("advanceBalance") AS "supplierAdvances",
           sum("undeliveredValue") AS "undeliveredOrders"
    FROM "SupplierAccount" GROUP BY "projectId"
  ),
  con AS (
    SELECT "projectId", sum("netPayable") AS "contractCommitted",
           sum("outstanding") AS "contractorOutstanding",
           sum("overpaid") AS "contractorAdvances"
    FROM "ContractBalance" GROUP BY "projectId"
  ),
  base AS (
    SELECT p."id" AS "projectId", p."type"::text AS "type", p."commissionPercent", p."clientContractAmount",
      coalesce(cash."clientReceipts", 0)       AS "clientReceipts",
      coalesce(cash."supplierPayments", 0)     AS "supplierPayments",
      coalesce(cash."contractorPayments", 0)   AS "contractorPayments",
      coalesce(cash."directExpenses", 0)       AS "directExpenses",
      coalesce(cash."partnerWithdrawals", 0)   AS "partnerWithdrawals",
      coalesce(sup."materialReceivedValue", 0) AS "materialReceivedValue",
      coalesce(sup."supplierOutstanding", 0)   AS "supplierOutstanding",
      coalesce(sup."supplierAdvances", 0)      AS "supplierAdvances",
      coalesce(sup."undeliveredOrders", 0)     AS "undeliveredOrders",
      coalesce(con."contractCommitted", 0)     AS "contractCommitted",
      coalesce(con."contractorOutstanding", 0) AS "contractorOutstanding",
      coalesce(con."contractorAdvances", 0)    AS "contractorAdvances"
    FROM "Project" p
    LEFT JOIN cash ON cash."projectId" = p."id"
    LEFT JOIN sup  ON sup."projectId"  = p."id"
    LEFT JOIN con  ON con."projectId"  = p."id"
  )
  SELECT b.*,
    b."clientReceipts" - b."supplierPayments" - b."contractorPayments"
      - b."directExpenses" - b."partnerWithdrawals" AS "cashBalance",
    b."materialReceivedValue" + b."contractorPayments" + b."directExpenses" AS "projectCost",
    CASE WHEN b."type" = 'COMMISSION'
         THEN round((b."materialReceivedValue" + b."contractorPayments" + b."directExpenses")
                    * b."commissionPercent" / 100, 2)
         ELSE NULL END AS "commissionAmount"
  FROM base b;

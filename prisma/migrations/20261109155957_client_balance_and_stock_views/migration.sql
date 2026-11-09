-- =============================================================================
-- Phase 2: client balance figures and per-site stock view.
-- =============================================================================

-- ProjectFinancialSummary gains two columns (appended, so CREATE OR REPLACE works):
--   clientBillable  = what the client should pay us so far
--                     COMMISSION: projectCost + commissionAmount
--                     others    : the agreed clientContractAmount (NULL if not entered)
--   clientAmountDue = clientBillable - clientReceipts
--                     (negative = client has paid ahead; NULL when billable is unknown)
CREATE OR REPLACE VIEW "ProjectFinancialSummary" AS
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
  ),
  calc AS (
    SELECT b.*,
      b."clientReceipts" - b."supplierPayments" - b."contractorPayments"
        - b."directExpenses" - b."partnerWithdrawals" AS "cashBalance",
      b."materialReceivedValue" + b."contractorPayments" + b."directExpenses" AS "projectCost",
      CASE WHEN b."type" = 'COMMISSION'
           THEN round((b."materialReceivedValue" + b."contractorPayments" + b."directExpenses")
                      * b."commissionPercent" / 100, 2)
           ELSE NULL END AS "commissionAmount"
    FROM base b
  )
  SELECT c.*,
    CASE WHEN c."type" = 'COMMISSION' THEN c."projectCost" + c."commissionAmount"
         ELSE c."clientContractAmount" END AS "clientBillable",
    CASE WHEN c."type" = 'COMMISSION' THEN c."projectCost" + c."commissionAmount" - c."clientReceipts"
         WHEN c."clientContractAmount" IS NOT NULL THEN c."clientContractAmount" - c."clientReceipts"
         ELSE NULL END AS "clientAmountDue"
  FROM calc c;

-- Stock per project + material. Stock is valued at the weighted-average
-- received rate. Consumption reduces quantity/value only; it is never cost again.
CREATE VIEW "ProjectStock" AS
  WITH rcv AS (
    SELECT r."projectId", l."materialId",
           sum(l."quantity") AS "receivedQty",
           sum(round(l."quantity" * l."rate", 2)) AS "receivedValue"
    FROM "MaterialReceiptLine" l
    JOIN "MaterialReceipt" r ON r."id" = l."receiptId"
    WHERE r."voidedAt" IS NULL
    GROUP BY r."projectId", l."materialId"
  ),
  ord AS (
    SELECT "projectId", "materialId", sum("orderedQty") AS "orderedQty"
    FROM "PurchaseOrderLineBalance" GROUP BY "projectId", "materialId"
  ),
  mov AS (
    SELECT "projectId", "materialId",
           sum(CASE WHEN "type" = 'ISSUE' THEN "quantity" ELSE 0 END)      AS "issuedQty",
           sum(CASE WHEN "type" = 'WASTAGE' THEN "quantity" ELSE 0 END)    AS "wastedQty",
           sum(CASE WHEN "type" = 'ADJUSTMENT' THEN "quantity" ELSE 0 END) AS "adjustedQty"
    FROM "StockMovement" WHERE "voidedAt" IS NULL
    GROUP BY "projectId", "materialId"
  ),
  keys AS (
    SELECT "projectId", "materialId" FROM rcv
    UNION SELECT "projectId", "materialId" FROM ord
    UNION SELECT "projectId", "materialId" FROM mov
  )
  SELECT k."projectId", k."materialId",
         coalesce(o."orderedQty", 0)  AS "orderedQty",
         coalesce(r."receivedQty", 0) AS "receivedQty",
         coalesce(r."receivedValue", 0) AS "receivedValue",
         coalesce(m."issuedQty", 0)   AS "issuedQty",
         coalesce(m."wastedQty", 0)   AS "wastedQty",
         coalesce(m."adjustedQty", 0) AS "adjustedQty",
         coalesce(r."receivedQty", 0) - coalesce(m."issuedQty", 0) - coalesce(m."wastedQty", 0)
           + coalesce(m."adjustedQty", 0) AS "onHandQty",
         CASE WHEN coalesce(r."receivedQty", 0) > 0
              THEN round(r."receivedValue" / r."receivedQty", 2) ELSE 0 END AS "avgRate",
         CASE WHEN coalesce(r."receivedQty", 0) > 0
              THEN round((coalesce(r."receivedQty", 0) - coalesce(m."issuedQty", 0) - coalesce(m."wastedQty", 0)
                          + coalesce(m."adjustedQty", 0)) * r."receivedValue" / r."receivedQty", 2)
              ELSE 0 END AS "stockValue"
  FROM keys k
  LEFT JOIN rcv r ON r."projectId" = k."projectId" AND r."materialId" = k."materialId"
  LEFT JOIN ord o ON o."projectId" = k."projectId" AND o."materialId" = k."materialId"
  LEFT JOIN mov m ON m."projectId" = k."projectId" AND m."materialId" = k."materialId";

-- Changing a project's client would silently move its payment history to the
-- other client (payments take their client from the project). Forbid it once
-- any client payment exists.
CREATE OR REPLACE FUNCTION app_project_client_locked() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."clientId" <> OLD."clientId"
     AND EXISTS (SELECT 1 FROM "ClientPayment" WHERE "projectId" = NEW."id") THEN
    RAISE EXCEPTION 'project client cannot be changed after client payments are recorded'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "Project_20_client_locked" BEFORE UPDATE ON "Project"
  FOR EACH ROW EXECUTE FUNCTION app_project_client_locked();

-- A client payment can never be moved to another project: void it and
-- record it again, so both projects' ledgers keep a visible trail.
CREATE OR REPLACE FUNCTION app_project_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."projectId" <> OLD."projectId" THEN
    RAISE EXCEPTION '% cannot be moved to another project; void it and record it again', TG_TABLE_NAME
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "ClientPayment_20_project_immutable" BEFORE UPDATE ON "ClientPayment"
  FOR EACH ROW EXECUTE FUNCTION app_project_immutable();

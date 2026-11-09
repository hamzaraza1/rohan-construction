-- =============================================================================
-- Phase 4: purchasing and inventory integrity rules.
-- =============================================================================

-- Records that must never be re-pointed after creation (void and re-enter instead).
CREATE TRIGGER "SupplierPayment_21_project_immutable" BEFORE UPDATE ON "SupplierPayment"
  FOR EACH ROW EXECUTE FUNCTION app_column_immutable('projectId');
CREATE TRIGGER "SupplierPayment_22_supplier_immutable" BEFORE UPDATE ON "SupplierPayment"
  FOR EACH ROW EXECUTE FUNCTION app_column_immutable('supplierId');
CREATE TRIGGER "MaterialReceipt_21_project_immutable" BEFORE UPDATE ON "MaterialReceipt"
  FOR EACH ROW EXECUTE FUNCTION app_column_immutable('projectId');
CREATE TRIGGER "MaterialReceipt_22_supplier_immutable" BEFORE UPDATE ON "MaterialReceipt"
  FOR EACH ROW EXECUTE FUNCTION app_column_immutable('supplierId');
CREATE TRIGGER "MaterialReceipt_23_po_immutable" BEFORE UPDATE ON "MaterialReceipt"
  FOR EACH ROW EXECUTE FUNCTION app_column_immutable('purchaseOrderId');
CREATE TRIGGER "PurchaseOrder_21_project_immutable" BEFORE UPDATE ON "PurchaseOrder"
  FOR EACH ROW EXECUTE FUNCTION app_column_immutable('projectId');
CREATE TRIGGER "StockMovement_21_project_immutable" BEFORE UPDATE ON "StockMovement"
  FOR EACH ROW EXECUTE FUNCTION app_column_immutable('projectId');
CREATE TRIGGER "StockMovement_22_material_immutable" BEFORE UPDATE ON "StockMovement"
  FOR EACH ROW EXECUTE FUNCTION app_column_immutable('materialId');

-- Receipt lines are written once with their receipt. A wrong receipt is voided
-- and entered again, so received quantities and values can never drift silently.
CREATE OR REPLACE FUNCTION app_receipt_line_frozen() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM "MaterialReceipt" WHERE "id" = NEW."receiptId" AND "voidedAt" IS NOT NULL) THEN
      RAISE EXCEPTION 'cannot add lines to a voided receipt' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'receipt lines cannot be modified; void the receipt and enter it again' USING ERRCODE = '23514';
END $$;

CREATE TRIGGER "MaterialReceiptLine_05_frozen" BEFORE INSERT OR UPDATE OR DELETE ON "MaterialReceiptLine"
  FOR EACH ROW EXECUTE FUNCTION app_receipt_line_frozen();

-- Material can only be received against an OPEN purchase order.
CREATE OR REPLACE FUNCTION app_receipt_po_open() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."purchaseOrderId" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "PurchaseOrder" WHERE "id" = NEW."purchaseOrderId" AND "status" <> 'OPEN'
  ) THEN
    RAISE EXCEPTION 'material can only be received against an open purchase order' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "MaterialReceipt_24_po_open" BEFORE INSERT ON "MaterialReceipt"
  FOR EACH ROW EXECUTE FUNCTION app_receipt_po_open();

-- Purchase order lines are fixed once anything has been received against them.
CREATE OR REPLACE FUNCTION app_po_line_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE line_id text := coalesce(OLD."id", NEW."id");
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND EXISTS (
    SELECT 1 FROM "MaterialReceiptLine" l JOIN "MaterialReceipt" r ON r."id" = l."receiptId"
    WHERE l."poLineId" = line_id AND r."voidedAt" IS NULL
  ) THEN
    RAISE EXCEPTION 'purchase order lines cannot be changed after material has been received against them'
      USING ERRCODE = '23514';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;

CREATE TRIGGER "PurchaseOrderLine_20_guard" BEFORE UPDATE OR DELETE ON "PurchaseOrderLine"
  FOR EACH ROW EXECUTE FUNCTION app_po_line_guard();

-- A purchase order with active receipts or payments cannot be cancelled
-- (close it instead), and a cancelled order cannot be reopened.
CREATE OR REPLACE FUNCTION app_po_status_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" = 'CANCELLED' AND OLD."status" <> 'CANCELLED' AND (
    EXISTS (SELECT 1 FROM "MaterialReceipt" WHERE "purchaseOrderId" = NEW."id" AND "voidedAt" IS NULL)
    OR EXISTS (SELECT 1 FROM "SupplierPayment" WHERE "purchaseOrderId" = NEW."id" AND "voidedAt" IS NULL)
  ) THEN
    RAISE EXCEPTION 'purchase order has receipts or payments; close it instead of cancelling'
      USING ERRCODE = '23514';
  END IF;
  IF OLD."status" = 'CANCELLED' AND NEW."status" <> 'CANCELLED' THEN
    RAISE EXCEPTION 'a cancelled purchase order cannot be reopened' USING ERRCODE = '23514';
  END IF;
  IF NEW."supplierId" <> OLD."supplierId" AND (
    EXISTS (SELECT 1 FROM "MaterialReceipt" WHERE "purchaseOrderId" = NEW."id")
    OR EXISTS (SELECT 1 FROM "SupplierPayment" WHERE "purchaseOrderId" = NEW."id")
  ) THEN
    RAISE EXCEPTION 'supplier cannot be changed after receipts or payments exist' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "PurchaseOrder_22_status_guard" BEFORE UPDATE ON "PurchaseOrder"
  FOR EACH ROW EXECUTE FUNCTION app_po_status_guard();

-- A material's unit cannot change once it is used (it would change the meaning of past quantities).
CREATE OR REPLACE FUNCTION app_material_unit_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."unit" <> OLD."unit" AND (
    EXISTS (SELECT 1 FROM "PurchaseOrderLine" WHERE "materialId" = NEW."id")
    OR EXISTS (SELECT 1 FROM "MaterialReceiptLine" WHERE "materialId" = NEW."id")
    OR EXISTS (SELECT 1 FROM "StockMovement" WHERE "materialId" = NEW."id")
  ) THEN
    RAISE EXCEPTION 'unit cannot be changed for a material that is already in use; create a new material instead'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "Material_20_unit_guard" BEFORE UPDATE ON "Material"
  FOR EACH ROW EXECUTE FUNCTION app_material_unit_guard();

-- Name of a material must not be blank.
ALTER TABLE "Material" ADD CONSTRAINT "Material_name_chk" CHECK (length(btrim("name")) > 0 AND length(btrim("unit")) > 0);

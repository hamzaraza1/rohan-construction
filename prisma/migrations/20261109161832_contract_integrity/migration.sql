-- =============================================================================
-- Phase 3: contract integrity rules.
-- =============================================================================

-- Generic guard: the named column can never change after insert.
CREATE OR REPLACE FUNCTION app_column_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE col text := TG_ARGV[0];
BEGIN
  IF (to_jsonb(NEW) ->> col) IS DISTINCT FROM (to_jsonb(OLD) ->> col) THEN
    RAISE EXCEPTION '%.% cannot be changed; void the record and enter it again', TG_TABLE_NAME, col
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "Contract_20_project_immutable" BEFORE UPDATE ON "Contract"
  FOR EACH ROW EXECUTE FUNCTION app_column_immutable('projectId');
CREATE TRIGGER "ContractorPayment_21_contract_immutable" BEFORE UPDATE ON "ContractorPayment"
  FOR EACH ROW EXECUTE FUNCTION app_column_immutable('contractId');
CREATE TRIGGER "ContractAdjustment_21_contract_immutable" BEFORE UPDATE ON "ContractAdjustment"
  FOR EACH ROW EXECUTE FUNCTION app_column_immutable('contractId');

-- The contractor on a contract cannot change once money has been paid on it,
-- and a contract cannot be voided while it has active payments or adjustments.
CREATE OR REPLACE FUNCTION app_contract_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."contractorId" <> OLD."contractorId" AND EXISTS (
    SELECT 1 FROM "ContractorPayment" WHERE "contractId" = NEW."id" AND "voidedAt" IS NULL
  ) THEN
    RAISE EXCEPTION 'contractor cannot be changed after payments are recorded on the contract'
      USING ERRCODE = '23514';
  END IF;
  IF OLD."voidedAt" IS NULL AND NEW."voidedAt" IS NOT NULL AND (
    EXISTS (SELECT 1 FROM "ContractorPayment" WHERE "contractId" = NEW."id" AND "voidedAt" IS NULL)
    OR EXISTS (SELECT 1 FROM "ContractAdjustment" WHERE "contractId" = NEW."id" AND "voidedAt" IS NULL)
  ) THEN
    RAISE EXCEPTION 'contract has active payments or adjustments; void those first'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "Contract_21_guard" BEFORE UPDATE ON "Contract"
  FOR EACH ROW EXECUTE FUNCTION app_contract_guard();

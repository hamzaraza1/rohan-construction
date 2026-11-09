import "server-only";
import { Prisma } from "@prisma/client";
import { dbRead } from "@/lib/db";

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;

export type ProjectSummaryRow = {
  projectId: string;
  name: string;
  clientName: string;
  type: "WITH_MATERIAL" | "LABOUR_RATE" | "COMMISSION";
  status: string;
  clientReceipts: Dec;
  supplierPayments: Dec;
  contractorPayments: Dec;
  directExpenses: Dec;
  partnerWithdrawals: Dec;
  cashBalance: Dec;
  projectCost: Dec;
  commissionAmount: Dec | null;
  supplierOutstanding: Dec;
  contractorOutstanding: Dec;
};

/** One row per (non-archived) project, straight from the ProjectFinancialSummary view. */
export async function getProjectSummaries(): Promise<ProjectSummaryRow[]> {
  return dbRead.$queryRaw<ProjectSummaryRow[]>`
    SELECT s."projectId", p."name", c."name" AS "clientName", s."type", p."status"::text AS "status",
           s."clientReceipts", s."supplierPayments", s."contractorPayments", s."directExpenses",
           s."partnerWithdrawals", s."cashBalance", s."projectCost", s."commissionAmount",
           s."supplierOutstanding", s."contractorOutstanding"
    FROM "ProjectFinancialSummary" s
    JOIN "Project" p ON p."id" = s."projectId"
    JOIN "Client" c ON c."id" = p."clientId"
    WHERE p."archivedAt" IS NULL
    ORDER BY CASE p."status" WHEN 'ACTIVE' THEN 0 WHEN 'PLANNING' THEN 1 WHEN 'ON_HOLD' THEN 2 ELSE 3 END, p."name"`;
}

export function totals(rows: ProjectSummaryRow[]) {
  const sum = (k: keyof ProjectSummaryRow) =>
    rows.reduce((acc, r) => acc.plus((r[k] as Dec | null) ?? 0), new D(0));
  return {
    clientReceipts: sum("clientReceipts"),
    cashOutflows: sum("supplierPayments").plus(sum("contractorPayments")).plus(sum("directExpenses")),
    supplierPayments: sum("supplierPayments"),
    contractorPayments: sum("contractorPayments"),
    directExpenses: sum("directExpenses"),
    partnerWithdrawals: sum("partnerWithdrawals"),
    cashBalance: sum("cashBalance"),
    projectCost: sum("projectCost"),
    supplierOutstanding: sum("supplierOutstanding"),
    contractorOutstanding: sum("contractorOutstanding"),
  };
}

export type MonthlyCashRow = { month: string; inflow: number; outflow: number; withdrawals: number };

/** Monthly money in / out for the last 12 months (all projects). */
export async function getMonthlyCashFlow(): Promise<MonthlyCashRow[]> {
  const rows = await dbRead.$queryRaw<{ month: Date; inflow: Dec; outflow: Dec; withdrawals: Dec }[]>`
    WITH months AS (
      SELECT generate_series(date_trunc('month', current_date) - interval '11 months',
                             date_trunc('month', current_date), interval '1 month')::date AS month
    )
    SELECT m.month,
           coalesce(sum(l."inflow"), 0) AS inflow,
           coalesce(sum(CASE WHEN l."sourceType" <> 'PARTNER_WITHDRAWAL' THEN l."outflow" ELSE 0 END), 0) AS outflow,
           coalesce(sum(CASE WHEN l."sourceType" = 'PARTNER_WITHDRAWAL' THEN l."outflow" ELSE 0 END), 0) AS withdrawals
    FROM months m
    LEFT JOIN "ProjectCashLedger" l ON date_trunc('month', l."date")::date = m.month
    GROUP BY m.month ORDER BY m.month`;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return rows.map((r) => ({
    month: `${MONTHS[r.month.getUTCMonth()]} ${String(r.month.getUTCFullYear()).slice(2)}`,
    inflow: Number(r.inflow),
    outflow: Number(r.outflow),
    withdrawals: Number(r.withdrawals),
  }));
}

export type LedgerRow = {
  sourceType: string;
  sourceId: string;
  projectId: string;
  projectName: string;
  date: Date;
  method: string;
  inflow: Dec;
  outflow: Dec;
  counterparty: string | null;
  description: string | null;
};

export async function getRecentTransactions(limit = 10, projectId?: string): Promise<LedgerRow[]> {
  return dbRead.$queryRaw<LedgerRow[]>`
    SELECT l."sourceType", l."sourceId", l."projectId", p."name" AS "projectName", l."date", l."method",
           l."inflow", l."outflow", l."counterparty", l."description"
    FROM "ProjectCashLedger" l
    JOIN "Project" p ON p."id" = l."projectId"
    WHERE ${projectId ?? null}::text IS NULL OR l."projectId" = ${projectId ?? null}
    ORDER BY l."date" DESC, l."createdAt" DESC
    LIMIT ${limit}`;
}

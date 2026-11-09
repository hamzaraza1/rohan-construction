import "server-only";
import { Prisma, type ProjectStatus, type ProjectType } from "@prisma/client";
import { dbRead } from "@/lib/db";

type Dec = Prisma.Decimal;

export type FinancialSummary = {
  projectId: string;
  type: ProjectType;
  commissionPercent: Dec | null;
  clientContractAmount: Dec | null;
  clientReceipts: Dec;
  supplierPayments: Dec;
  contractorPayments: Dec;
  directExpenses: Dec;
  partnerWithdrawals: Dec;
  materialReceivedValue: Dec;
  supplierOutstanding: Dec;
  supplierAdvances: Dec;
  undeliveredOrders: Dec;
  contractCommitted: Dec;
  contractorOutstanding: Dec;
  contractorAdvances: Dec;
  cashBalance: Dec;
  projectCost: Dec;
  commissionAmount: Dec | null;
  clientBillable: Dec | null;
  clientAmountDue: Dec | null;
};

export async function getFinancialSummary(projectId: string): Promise<FinancialSummary | null> {
  const rows = await dbRead.$queryRaw<FinancialSummary[]>`
    SELECT * FROM "ProjectFinancialSummary" WHERE "projectId" = ${projectId}`;
  return rows[0] ?? null;
}

export async function getSummariesByProject(projectIds: string[]): Promise<Map<string, FinancialSummary>> {
  if (projectIds.length === 0) return new Map();
  const rows = await dbRead.$queryRaw<FinancialSummary[]>`
    SELECT * FROM "ProjectFinancialSummary" WHERE "projectId" IN (${Prisma.join(projectIds)})`;
  return new Map(rows.map((r) => [r.projectId, r]));
}

export type ProjectListFilters = { q?: string; status?: ProjectStatus; type?: ProjectType; archived?: boolean };

export async function listProjects(f: ProjectListFilters) {
  const projects = await dbRead.project.findMany({
    where: {
      archivedAt: f.archived ? { not: null } : null,
      status: f.status,
      type: f.type,
      ...(f.q
        ? {
            OR: [
              { name: { contains: f.q, mode: "insensitive" } },
              { siteAddress: { contains: f.q, mode: "insensitive" } },
              { client: { name: { contains: f.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { client: { select: { id: true, name: true } } },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });
  const summaries = await getSummariesByProject(projects.map((p) => p.id));
  return projects.map((p) => ({ ...p, summary: summaries.get(p.id)! }));
}

export async function getProject(id: string) {
  return dbRead.project.findUnique({
    where: { id },
    include: { client: true },
  });
}

export type LedgerEntry = {
  sourceType: string;
  sourceId: string;
  date: Date;
  method: string;
  inflow: Dec;
  outflow: Dec;
  counterparty: string | null;
  description: string | null;
  reference: string | null;
  balance: Dec;
};

/** The project's cash ledger with a running balance (oldest → newest), filtered by date. */
export async function getProjectLedger(projectId: string, from?: Date | null, to?: Date | null): Promise<{ entries: LedgerEntry[]; opening: Dec }> {
  const entries = await dbRead.$queryRaw<LedgerEntry[]>`
    SELECT * FROM (
      SELECT l."sourceType", l."sourceId", l."date", l."method", l."inflow", l."outflow",
             l."counterparty", l."description", l."reference", l."createdAt",
             sum(l."inflow" - l."outflow") OVER (ORDER BY l."date", l."createdAt", l."sourceId") AS "balance"
      FROM "ProjectCashLedger" l
      WHERE l."projectId" = ${projectId}
    ) x
    WHERE (${from ?? null}::date IS NULL OR x."date" >= ${from ?? null}::date)
      AND (${to ?? null}::date IS NULL OR x."date" <= ${to ?? null}::date)
    ORDER BY x."date", x."createdAt", x."sourceId"`;
  // Opening balance = everything before `from`.
  let opening = new Prisma.Decimal(0);
  if (from) {
    const [row] = await dbRead.$queryRaw<{ total: Dec | null }[]>`
      SELECT sum("inflow" - "outflow") AS total FROM "ProjectCashLedger"
      WHERE "projectId" = ${projectId} AND "date" < ${from}::date`;
    opening = row?.total ?? opening;
  }
  return { entries, opening };
}

export type StockSummary = { materials: number; stockValue: Dec; receivedValue: Dec };

export async function getStockSummary(projectId: string): Promise<StockSummary> {
  const [row] = await dbRead.$queryRaw<StockSummary[]>`
    SELECT count(*) FILTER (WHERE "onHandQty" > 0)::int AS materials,
           coalesce(sum("stockValue"), 0) AS "stockValue",
           coalesce(sum("receivedValue"), 0) AS "receivedValue"
    FROM "ProjectStock" WHERE "projectId" = ${projectId}`;
  return row;
}

export async function listClientPayments(where: Prisma.ClientPaymentWhereInput, take = 200) {
  return dbRead.clientPayment.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
    include: {
      project: { select: { id: true, name: true, client: { select: { id: true, name: true } } } },
      attachment: { select: { id: true, originalName: true } },
    },
  });
}

export async function clientOptions() {
  return dbRead.client.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true },
  });
}

export async function projectOptions() {
  return dbRead.project.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, client: { select: { name: true } } },
  });
}

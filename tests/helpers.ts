import { Prisma, PrismaClient } from "@prisma/client";
import { TEST_DB_READONLY_URL, TEST_DB_URL } from "./env";

export const db = new PrismaClient({ datasourceUrl: TEST_DB_URL });
export const dbRead = new PrismaClient({ datasourceUrl: TEST_DB_READONLY_URL });
export const D = (v: number | string) => new Prisma.Decimal(v);
export const day = (s: string) => new Date(`${s}T00:00:00Z`);

let counter = 0;
export const uniq = (p: string) => `${p}-${Date.now()}-${++counter}`;

/** Runs `fn` in a transaction acting as the given user (what adminMutation does). */
export function as<T>(userId: string | null, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  return db.$transaction(async (tx) => {
    if (userId) await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    return fn(tx);
  });
}

export async function makeUsers() {
  const admin = await db.user.create({ data: { name: "Hamza", username: uniq("admin"), role: "ADMIN", passwordHash: "x" } });
  const viewer = await db.user.create({ data: { name: "Partner", username: uniq("viewer"), role: "VIEWER", passwordHash: "x" } });
  return { admin, viewer };
}

export async function makeProject(adminId: string, overrides: Partial<Prisma.ProjectUncheckedCreateInput> = {}) {
  return as(adminId, async (tx) => {
    const client = await tx.client.create({ data: { name: uniq("Client"), phone: "0300-0000000" } });
    return tx.project.create({
      data: {
        name: uniq("Site"),
        clientId: client.id,
        siteAddress: "Plot 1, Lahore",
        type: "WITH_MATERIAL",
        startDate: day("2026-01-01"),
        ...overrides,
      },
    });
  });
}

export type Summary = {
  clientReceipts: Prisma.Decimal; supplierPayments: Prisma.Decimal; contractorPayments: Prisma.Decimal;
  directExpenses: Prisma.Decimal; partnerWithdrawals: Prisma.Decimal; materialReceivedValue: Prisma.Decimal;
  supplierOutstanding: Prisma.Decimal; supplierAdvances: Prisma.Decimal; undeliveredOrders: Prisma.Decimal;
  contractCommitted: Prisma.Decimal; contractorOutstanding: Prisma.Decimal; contractorAdvances: Prisma.Decimal;
  cashBalance: Prisma.Decimal; projectCost: Prisma.Decimal; commissionAmount: Prisma.Decimal | null;
};

export async function summary(projectId: string): Promise<Summary> {
  const rows = await dbRead.$queryRaw<Summary[]>`SELECT * FROM "ProjectFinancialSummary" WHERE "projectId" = ${projectId}`;
  return rows[0];
}

export const str = (d: Prisma.Decimal | null) => (d === null ? null : d.toFixed(2));

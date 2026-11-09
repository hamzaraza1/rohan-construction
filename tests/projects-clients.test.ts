import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, day, db, dbRead, makeProject, makeUsers, uniq } from "./helpers";

let adminId: string;
type Due = { clientBillable: { toFixed(n: number): string } | null; clientAmountDue: { toFixed(n: number): string } | null };
const due = async (projectId: string) =>
  (await dbRead.$queryRaw<Due[]>`SELECT "clientBillable", "clientAmountDue" FROM "ProjectFinancialSummary" WHERE "projectId" = ${projectId}`)[0];
const fmt = (d: { toFixed(n: number): string } | null) => (d === null ? null : d.toFixed(2));

beforeAll(async () => {
  adminId = (await makeUsers()).admin.id;
});
afterAll(async () => {
  await db.$disconnect();
  await dbRead.$disconnect();
});

const pay = (projectId: string, amount: number) =>
  as(adminId, (tx) => tx.clientPayment.create({ data: { projectId, amount, date: day("2026-06-01"), method: "CASH", createdById: adminId } }));

describe("client balance", () => {
  it("with an agreed contract value: due = agreed − received", async () => {
    const p = await makeProject(adminId, { clientContractAmount: 10_000_000 });
    await pay(p.id, 2_500_000);
    const d = await due(p.id);
    expect(fmt(d.clientBillable)).toBe("10000000.00");
    expect(fmt(d.clientAmountDue)).toBe("7500000.00");
  });

  it("without an agreed value the amount due is unknown (null), not zero", async () => {
    const p = await makeProject(adminId, { type: "LABOUR_RATE" });
    await pay(p.id, 100_000);
    const d = await due(p.id);
    expect(d.clientBillable).toBeNull();
    expect(d.clientAmountDue).toBeNull();
  });

  it("commission project: due = cost + commission − received (negative = paid ahead)", async () => {
    const p = await makeProject(adminId, { type: "COMMISSION", commissionPercent: 12 });
    const cat = await as(adminId, (tx) => tx.expenseCategory.create({ data: { name: uniq("Labour") } }));
    await as(adminId, (tx) =>
      tx.expense.create({
        data: { projectId: p.id, categoryId: cat.id, amount: 500_000, date: day("2026-06-02"), paidTo: "Labour", method: "CASH", createdById: adminId },
      }),
    );
    await pay(p.id, 600_000);
    const d = await due(p.id);
    expect(fmt(d.clientBillable)).toBe("560000.00"); // 500,000 + 12%
    expect(fmt(d.clientAmountDue)).toBe("-40000.00"); // client paid 40,000 ahead
  });
});

describe("project and payment rules", () => {
  it("a project's client cannot be changed once client payments exist", async () => {
    const p = await makeProject(adminId);
    const other = await as(adminId, (tx) => tx.client.create({ data: { name: uniq("Other"), phone: "1" } }));
    // Allowed before any payment.
    await as(adminId, (tx) => tx.project.update({ where: { id: p.id }, data: { clientId: other.id } }));
    await pay(p.id, 1000);
    const third = await as(adminId, (tx) => tx.client.create({ data: { name: uniq("Third"), phone: "1" } }));
    await expect(as(adminId, (tx) => tx.project.update({ where: { id: p.id }, data: { clientId: third.id } }))).rejects.toThrow(
      /client cannot be changed/,
    );
  });

  it("a client payment cannot be moved to another project", async () => {
    const [p1, p2] = [await makeProject(adminId), await makeProject(adminId)];
    const payment = await pay(p1.id, 5000);
    await expect(as(adminId, (tx) => tx.clientPayment.update({ where: { id: payment.id }, data: { projectId: p2.id } }))).rejects.toThrow(
      /cannot be moved/,
    );
  });

  it("editing a payment is audited with before and after values", async () => {
    const p = await makeProject(adminId);
    const payment = await pay(p.id, 5000);
    await as(adminId, (tx) => tx.clientPayment.update({ where: { id: payment.id }, data: { amount: 5500 } }));
    const log = await db.auditLog.findFirstOrThrow({ where: { entityId: payment.id, action: "UPDATE" } });
    expect((log.before as { amount: number }).amount).toBe(5000);
    expect((log.after as { amount: number }).amount).toBe(5500);
    expect(log.userId).toBe(adminId);
  });

  it("archiving a project keeps its money in the ledger", async () => {
    const p = await makeProject(adminId);
    await pay(p.id, 7000);
    await as(adminId, (tx) => tx.project.update({ where: { id: p.id }, data: { archivedAt: new Date() } }));
    const [row] = await dbRead.$queryRaw<{ cashBalance: { toFixed(n: number): string } }[]>`
      SELECT "cashBalance" FROM "ProjectFinancialSummary" WHERE "projectId" = ${p.id}`;
    expect(row.cashBalance.toFixed(2)).toBe("7000.00");
  });
});

describe("ProjectStock view", () => {
  it("values remaining stock at the weighted average received rate", async () => {
    const p = await makeProject(adminId);
    const { supplierId, materialId } = await as(adminId, async (tx) => {
      const s = await tx.supplier.create({ data: { name: uniq("S"), phone: "1" } });
      const mc = await tx.materialCategory.create({ data: { name: uniq("Steel") } });
      const m = await tx.material.create({ data: { name: uniq("Steel bar"), unit: "kg", categoryId: mc.id } });
      return { supplierId: s.id, materialId: m.id };
    });
    await as(adminId, (tx) =>
      tx.materialReceipt.create({
        data: {
          projectId: p.id, supplierId, receiptDate: day("2026-06-01"), createdById: adminId,
          lines: { create: [{ materialId, quantity: 100, rate: 200 }, { materialId, quantity: 100, rate: 300 }] },
        },
      }),
    );
    await as(adminId, (tx) =>
      tx.stockMovement.create({ data: { projectId: p.id, materialId, type: "ISSUE", quantity: 50, date: day("2026-06-02"), createdById: adminId } }),
    );
    const [row] = await dbRead.$queryRaw<{ onHandQty: unknown; avgRate: unknown; stockValue: unknown; receivedValue: unknown }[]>`
      SELECT "onHandQty", "avgRate", "stockValue", "receivedValue" FROM "ProjectStock" WHERE "projectId" = ${p.id}`;
    expect(String(row.onHandQty)).toBe("150");
    expect(String(row.avgRate)).toBe("250");
    expect(String(row.stockValue)).toBe("37500");
    expect(String(row.receivedValue)).toBe("50000");
  });
});

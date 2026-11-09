import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, day, db, dbRead, makeProject, makeUsers, str, summary, uniq } from "./helpers";

let adminId: string;
let expenseCategoryId: string;
let materialId: string;
let workCategoryId: string;

beforeAll(async () => {
  const { admin } = await makeUsers();
  adminId = admin.id;
  await as(adminId, async (tx) => {
    expenseCategoryId = (await tx.expenseCategory.create({ data: { name: uniq("Transport") } })).id;
    const mc = await tx.materialCategory.create({ data: { name: uniq("Cement") } });
    materialId = (await tx.material.create({ data: { name: uniq("OPC Cement"), unit: "bag", categoryId: mc.id } })).id;
    workCategoryId = (await tx.workCategory.create({ data: { name: uniq("Brickwork") } })).id;
  });
});
afterAll(async () => {
  await db.$disconnect();
  await dbRead.$disconnect();
});

/**
 * The worked example from the requirements:
 *  - Supplier order Rs. 500,000; advance Rs. 300,000; material delivered gradually.
 *  - Labour contract Rs. 2,500,000 with advance, extra and deduction.
 *  - Client receipt, an expense and a partner withdrawal.
 */
describe("project ledger: no double counting", () => {
  it("tracks the supplier order / advance / delivery cycle correctly", async () => {
    const project = await makeProject(adminId);
    const supplier = await as(adminId, (tx) => tx.supplier.create({ data: { name: uniq("Supplier"), phone: "1" } }));

    // 1. Order: 1000 bags @ 500 = 500,000. A commitment only.
    const po = await as(adminId, (tx) =>
      tx.purchaseOrder.create({
        data: {
          projectId: project.id, supplierId: supplier.id, orderDate: day("2026-03-01"), createdById: adminId,
          lines: { create: [{ materialId, quantity: 1000, rate: 500 }] },
        },
        include: { lines: true },
      }),
    );
    let s = await summary(project.id);
    expect(str(s.cashBalance)).toBe("0.00");
    expect(str(s.projectCost)).toBe("0.00");
    expect(str(s.undeliveredOrders)).toBe("500000.00");

    // 2. Advance 300,000: cash goes down, but it is NOT material and NOT cost.
    await as(adminId, (tx) =>
      tx.supplierPayment.create({
        data: {
          projectId: project.id, supplierId: supplier.id, purchaseOrderId: po.id, type: "ADVANCE",
          amount: 300000, date: day("2026-03-02"), method: "BANK_TRANSFER", createdById: adminId,
        },
      }),
    );
    s = await summary(project.id);
    expect(str(s.cashBalance)).toBe("-300000.00");
    expect(str(s.materialReceivedValue)).toBe("0.00");
    expect(str(s.projectCost)).toBe("0.00");
    expect(str(s.supplierAdvances)).toBe("300000.00");
    expect(str(s.supplierOutstanding)).toBe("0.00");

    // 3. First delivery: 400 bags = 200,000. Advance partly consumed.
    const receive = (qty: number, date: string) =>
      as(adminId, (tx) =>
        tx.materialReceipt.create({
          data: {
            projectId: project.id, supplierId: supplier.id, purchaseOrderId: po.id, receiptDate: day(date), createdById: adminId,
            lines: { create: [{ materialId, poLineId: po.lines[0].id, quantity: qty, rate: 500 }] },
          },
        }),
      );
    await receive(400, "2026-03-05");
    s = await summary(project.id);
    expect(str(s.materialReceivedValue)).toBe("200000.00");
    expect(str(s.projectCost)).toBe("200000.00");
    expect(str(s.supplierAdvances)).toBe("100000.00");
    expect(str(s.supplierOutstanding)).toBe("0.00");
    expect(str(s.undeliveredOrders)).toBe("300000.00");
    expect(str(s.cashBalance)).toBe("-300000.00"); // receiving goods moves no cash

    // 4. Second delivery: 500 bags = 250,000. Now we owe the supplier 150,000.
    await receive(500, "2026-03-10");
    s = await summary(project.id);
    expect(str(s.materialReceivedValue)).toBe("450000.00");
    expect(str(s.supplierAdvances)).toBe("0.00");
    expect(str(s.supplierOutstanding)).toBe("150000.00");
    expect(str(s.undeliveredOrders)).toBe("50000.00");

    // 5. Paying the 150,000 settles the liability; cost does NOT increase again.
    await as(adminId, (tx) =>
      tx.supplierPayment.create({
        data: {
          projectId: project.id, supplierId: supplier.id, type: "PAYMENT", amount: 150000,
          date: day("2026-03-12"), method: "CASH", createdById: adminId,
        },
      }),
    );
    s = await summary(project.id);
    expect(str(s.supplierOutstanding)).toBe("0.00");
    expect(str(s.projectCost)).toBe("450000.00");
    expect(str(s.cashBalance)).toBe("-450000.00");

    // 6. Closing the PO releases the undelivered 50,000.
    await as(adminId, (tx) => tx.purchaseOrder.update({ where: { id: po.id }, data: { status: "CLOSED" } }));
    s = await summary(project.id);
    expect(str(s.undeliveredOrders)).toBe("0.00");

    // Stock: 900 received; cannot issue more than is on hand.
    const issue = (qty: number) =>
      as(adminId, (tx) =>
        tx.stockMovement.create({
          data: { projectId: project.id, materialId, type: "ISSUE", quantity: qty, date: day("2026-03-15"), createdById: adminId },
        }),
      );
    await expect(issue(901)).rejects.toThrow(/insufficient stock/);
    await issue(600);
    const [{ qty }] = await dbRead.$queryRaw<{ qty: string }[]>`SELECT app_stock_on_hand(${project.id}, ${materialId})::text AS qty`;
    expect(Number(qty)).toBe(300);
    // Consumption does not change project cost (no double counting).
    s = await summary(project.id);
    expect(str(s.projectCost)).toBe("450000.00");
  });

  it("treats a contract amount as a commitment and tracks contractor balances", async () => {
    const project = await makeProject(adminId);
    const contractor = await as(adminId, (tx) => tx.contractor.create({ data: { name: uniq("Contractor"), phone: "1" } }));
    const contract = await as(adminId, (tx) =>
      tx.contract.create({
        data: {
          projectId: project.id, contractorId: contractor.id, title: "Complete labour contract",
          contractAmount: 2500000, startDate: day("2026-01-10"), createdById: adminId,
          scopeItems: { create: [{ workCategoryId, included: true }] },
        },
      }),
    );
    let s = await summary(project.id);
    expect(str(s.contractCommitted)).toBe("2500000.00");
    expect(str(s.contractorOutstanding)).toBe("2500000.00");
    expect(str(s.cashBalance)).toBe("0.00");
    expect(str(s.projectCost)).toBe("0.00");

    await as(adminId, async (tx) => {
      await tx.contractorPayment.create({
        data: {
          contractId: contract.id, projectId: project.id, type: "ADVANCE", amount: 500000,
          date: day("2026-01-11"), method: "CASH", createdById: adminId,
        },
      });
      await tx.contractAdjustment.create({
        data: { contractId: contract.id, type: "EXTRA", amount: 100000, date: day("2026-02-01"), reason: "Boundary wall", createdById: adminId },
      });
      await tx.contractAdjustment.create({
        data: { contractId: contract.id, type: "DEDUCTION", amount: 50000, date: day("2026-02-02"), reason: "Rework", createdById: adminId },
      });
    });
    s = await summary(project.id);
    expect(str(s.contractCommitted)).toBe("2550000.00");
    expect(str(s.contractorPayments)).toBe("500000.00");
    expect(str(s.contractorOutstanding)).toBe("2050000.00");
    expect(str(s.cashBalance)).toBe("-500000.00");
  });

  it("a contractor payment cannot be booked to a different project than its contract", async () => {
    const p1 = await makeProject(adminId);
    const p2 = await makeProject(adminId);
    const contractor = await as(adminId, (tx) => tx.contractor.create({ data: { name: uniq("C"), phone: "1" } }));
    const contract = await as(adminId, (tx) =>
      tx.contract.create({
        data: { projectId: p1.id, contractorId: contractor.id, title: "x", contractAmount: 1000, startDate: day("2026-01-01"), createdById: adminId },
      }),
    );
    await expect(
      as(adminId, (tx) =>
        tx.contractorPayment.create({
          data: { contractId: contract.id, projectId: p2.id, type: "ADVANCE", amount: 10, date: day("2026-01-02"), method: "CASH", createdById: adminId },
        }),
      ),
    ).rejects.toThrow();
  });

  it("computes cash balance = receipts − outflows − withdrawals; withdrawals are not cost", async () => {
    const project = await makeProject(adminId, { type: "COMMISSION", commissionPercent: 10 });
    const partner = await as(adminId, (tx) => tx.partner.create({ data: { name: uniq("Hamza") } }));
    await as(adminId, async (tx) => {
      await tx.clientPayment.create({
        data: { projectId: project.id, amount: 1000000, date: day("2026-04-01"), method: "BANK_TRANSFER", createdById: adminId },
      });
      await tx.expense.create({
        data: {
          projectId: project.id, categoryId: expenseCategoryId, amount: 200000, date: day("2026-04-02"),
          paidTo: "Transporter", method: "CASH", createdById: adminId,
        },
      });
      await tx.partnerWithdrawal.create({
        data: { partnerId: partner.id, projectId: project.id, amount: 50000, date: day("2026-04-03"), method: "CASH", createdById: adminId },
      });
    });
    const s = await summary(project.id);
    expect(str(s.clientReceipts)).toBe("1000000.00");
    expect(str(s.directExpenses)).toBe("200000.00");
    expect(str(s.partnerWithdrawals)).toBe("50000.00");
    expect(str(s.cashBalance)).toBe("750000.00");
    expect(str(s.projectCost)).toBe("200000.00"); // withdrawal excluded
    expect(str(s.commissionAmount)).toBe("20000.00"); // 10% of 200,000

    // Ledger contains exactly the three cash movements.
    const ledger = await dbRead.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "ProjectCashLedger" WHERE "projectId" = ${project.id}`;
    expect(Number(ledger[0].n)).toBe(3);
  });

  it("voided records drop out of every balance", async () => {
    const project = await makeProject(adminId);
    const pay = await as(adminId, (tx) =>
      tx.clientPayment.create({ data: { projectId: project.id, amount: 75000, date: day("2026-05-01"), method: "CASH", createdById: adminId } }),
    );
    expect(str((await summary(project.id)).cashBalance)).toBe("75000.00");
    await as(adminId, (tx) =>
      tx.clientPayment.update({ where: { id: pay.id }, data: { voidedAt: new Date(), voidReason: "Wrong project" } }),
    );
    expect(str((await summary(project.id)).cashBalance)).toBe("0.00");
  });

  it("a receipt cannot be linked to another supplier's purchase order", async () => {
    const project = await makeProject(adminId);
    const [s1, s2] = await as(adminId, (tx) =>
      Promise.all([tx.supplier.create({ data: { name: uniq("S1"), phone: "1" } }), tx.supplier.create({ data: { name: uniq("S2"), phone: "1" } })]),
    );
    const po = await as(adminId, (tx) =>
      tx.purchaseOrder.create({ data: { projectId: project.id, supplierId: s1.id, orderDate: day("2026-01-01"), createdById: adminId } }),
    );
    await expect(
      as(adminId, (tx) =>
        tx.materialReceipt.create({
          data: { projectId: project.id, supplierId: s2.id, purchaseOrderId: po.id, receiptDate: day("2026-01-02"), createdById: adminId },
        }),
      ),
    ).rejects.toThrow(/does not belong/);
  });
});

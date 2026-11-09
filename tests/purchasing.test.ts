import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, day, db, dbRead, makeProject, makeUsers, uniq } from "./helpers";

let adminId: string;
let materialId: string;
beforeAll(async () => {
  adminId = (await makeUsers()).admin.id;
  materialId = await as(adminId, async (tx) => {
    const mc = await tx.materialCategory.create({ data: { name: uniq("Bricks") } });
    return (await tx.material.create({ data: { name: uniq("Bricks A-class"), unit: "piece", categoryId: mc.id } })).id;
  });
});
afterAll(async () => {
  await db.$disconnect();
  await dbRead.$disconnect();
});

async function setup() {
  const project = await makeProject(adminId);
  const supplier = await as(adminId, (tx) => tx.supplier.create({ data: { name: uniq("Kiln"), phone: "1" } }));
  const po = await as(adminId, (tx) =>
    tx.purchaseOrder.create({
      data: { projectId: project.id, supplierId: supplier.id, orderDate: day("2026-03-01"), createdById: adminId, lines: { create: [{ materialId, quantity: 10000, rate: 15 }] } },
      include: { lines: true },
    }),
  );
  return { project, supplier, po };
}
const receive = (s: Awaited<ReturnType<typeof setup>>, qty: number) =>
  as(adminId, (tx) =>
    tx.materialReceipt.create({
      data: {
        projectId: s.project.id, supplierId: s.supplier.id, purchaseOrderId: s.po.id, receiptDate: day("2026-03-05"), createdById: adminId,
        lines: { create: [{ materialId, poLineId: s.po.lines[0].id, quantity: qty, rate: 15 }] },
      },
      include: { lines: true },
    }),
  );

describe("purchasing integrity", () => {
  it("receipt lines are frozen once written", async () => {
    const s = await setup();
    const r = await receive(s, 1000);
    await expect(as(adminId, (tx) => tx.materialReceiptLine.update({ where: { id: r.lines[0].id }, data: { quantity: 999 } }))).rejects.toThrow(
      /receipt lines cannot be modified/,
    );
    await expect(as(adminId, (tx) => tx.materialReceiptLine.delete({ where: { id: r.lines[0].id } }))).rejects.toThrow(/cannot be modified/);
  });

  it("order lines cannot change after material is received against them", async () => {
    const s = await setup();
    await receive(s, 1000);
    await expect(as(adminId, (tx) => tx.purchaseOrderLine.update({ where: { id: s.po.lines[0].id }, data: { rate: 20 } }))).rejects.toThrow(
      /cannot be changed after material has been received/,
    );
  });

  it("material can only be received against an open order", async () => {
    const s = await setup();
    await as(adminId, (tx) => tx.purchaseOrder.update({ where: { id: s.po.id }, data: { status: "CLOSED" } }));
    await expect(receive(s, 10)).rejects.toThrow(/open purchase order/);
  });

  it("an order with deliveries cannot be cancelled, only closed; cancelled orders cannot reopen", async () => {
    const s = await setup();
    await receive(s, 100);
    await expect(as(adminId, (tx) => tx.purchaseOrder.update({ where: { id: s.po.id }, data: { status: "CANCELLED" } }))).rejects.toThrow(
      /close it instead/,
    );
    const s2 = await setup();
    await as(adminId, (tx) => tx.purchaseOrder.update({ where: { id: s2.po.id }, data: { status: "CANCELLED" } }));
    await expect(as(adminId, (tx) => tx.purchaseOrder.update({ where: { id: s2.po.id }, data: { status: "OPEN" } }))).rejects.toThrow(
      /cannot be reopened/,
    );
  });

  it("a supplier payment cannot be moved to another project or supplier", async () => {
    const s = await setup();
    const other = await makeProject(adminId);
    const pay = await as(adminId, (tx) =>
      tx.supplierPayment.create({ data: { projectId: s.project.id, supplierId: s.supplier.id, type: "ADVANCE", amount: 1000, date: day("2026-03-02"), method: "CASH", createdById: adminId } }),
    );
    await expect(as(adminId, (tx) => tx.supplierPayment.update({ where: { id: pay.id }, data: { projectId: other.id } }))).rejects.toThrow(/cannot be changed/);
  });

  it("voiding a receipt whose material was already used is refused (stock would go negative)", async () => {
    const s = await setup();
    const r = await receive(s, 500);
    await as(adminId, (tx) =>
      tx.stockMovement.create({ data: { projectId: s.project.id, materialId, type: "ISSUE", quantity: 300, date: day("2026-03-06"), createdById: adminId } }),
    );
    await expect(
      as(adminId, (tx) => tx.materialReceipt.update({ where: { id: r.id }, data: { voidedAt: new Date(), voidReason: "wrong" } })),
    ).rejects.toThrow(/stock negative/);
  });

  it("a negative stock correction cannot exceed stock on hand; a positive one adds stock", async () => {
    const s = await setup();
    await receive(s, 100);
    const adjust = (q: number) =>
      as(adminId, (tx) =>
        tx.stockMovement.create({ data: { projectId: s.project.id, materialId, type: "ADJUSTMENT", quantity: q, date: day("2026-03-07"), notes: "count", createdById: adminId } }),
      );
    await expect(adjust(-101)).rejects.toThrow(/insufficient stock/);
    await adjust(5);
    const [row] = await dbRead.$queryRaw<{ onHandQty: unknown }[]>`SELECT "onHandQty" FROM "ProjectStock" WHERE "projectId" = ${s.project.id}`;
    expect(String(row.onHandQty)).toBe("105");
  });

  it("a material's unit is locked once used", async () => {
    const s = await setup();
    void s;
    await expect(as(adminId, (tx) => tx.material.update({ where: { id: materialId }, data: { unit: "thousand" } }))).rejects.toThrow(/unit cannot be changed/);
  });

  it("advances are tracked per project: an advance on site A does not settle site B", async () => {
    const a = await setup();
    const b = await makeProject(adminId);
    await as(adminId, (tx) =>
      tx.supplierPayment.create({ data: { projectId: a.project.id, supplierId: a.supplier.id, type: "ADVANCE", amount: 50000, date: day("2026-03-02"), method: "CASH", createdById: adminId } }),
    );
    await as(adminId, (tx) =>
      tx.materialReceipt.create({
        data: { projectId: b.id, supplierId: a.supplier.id, receiptDate: day("2026-03-03"), createdById: adminId, lines: { create: [{ materialId, quantity: 1000, rate: 15 }] } },
      }),
    );
    const rows = await dbRead.$queryRaw<{ projectId: string; advanceBalance: { toFixed(n: number): string }; outstandingPayable: { toFixed(n: number): string } }[]>`
      SELECT "projectId", "advanceBalance", "outstandingPayable" FROM "SupplierAccount" WHERE "supplierId" = ${a.supplier.id}`;
    const A = rows.find((r) => r.projectId === a.project.id)!;
    const B = rows.find((r) => r.projectId === b.id)!;
    expect(A.advanceBalance.toFixed(2)).toBe("50000.00");
    expect(B.outstandingPayable.toFixed(2)).toBe("15000.00");
  });
});

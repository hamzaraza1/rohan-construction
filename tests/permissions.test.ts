import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, day, db, dbRead, makeProject, makeUsers, uniq } from "./helpers";

let admin: { id: string };
let viewer: { id: string };

beforeAll(async () => {
  ({ admin, viewer } = await makeUsers());
});
afterAll(async () => {
  await db.$disconnect();
  await dbRead.$disconnect();
});

describe("database-level permission enforcement", () => {
  it("the read-only database role cannot write anything", async () => {
    await expect(dbRead.client.create({ data: { name: "X", phone: "1" } })).rejects.toThrow(/permission denied/);
  });

  it("the read-only role cannot read password hashes or sessions", async () => {
    await expect(dbRead.$queryRaw`SELECT "passwordHash" FROM "User" LIMIT 1`).rejects.toThrow(/permission denied/);
    await expect(dbRead.$queryRaw`SELECT * FROM "Session" LIMIT 1`).rejects.toThrow(/permission denied/);
    const rows = await dbRead.$queryRaw<{ name: string }[]>`SELECT "name" FROM "User" LIMIT 1`;
    expect(rows.length).toBe(1);
  });

  it("rejects writes with no acting user", async () => {
    await expect(as(null, (tx) => tx.client.create({ data: { name: "X", phone: "1" } }))).rejects.toThrow(/no acting user/);
  });

  it("rejects writes by a read-only (VIEWER) user", async () => {
    await expect(as(viewer.id, (tx) => tx.client.create({ data: { name: "X", phone: "1" } }))).rejects.toThrow(/not an active admin/);
  });

  it("rejects writes by a deactivated admin", async () => {
    const ex = await db.user.create({ data: { name: "Old", username: uniq("old"), role: "ADMIN", isActive: false, passwordHash: "x" } });
    await expect(as(ex.id, (tx) => tx.client.create({ data: { name: "X", phone: "1" } }))).rejects.toThrow(/not an active admin/);
  });

  it("allows writes by an active admin and audits them with the acting user", async () => {
    const client = await as(admin.id, (tx) => tx.client.create({ data: { name: "Audited Client", phone: "1" } }));
    const log = await db.auditLog.findFirst({ where: { entityType: "Client", entityId: client.id } });
    expect(log?.action).toBe("INSERT");
    expect(log?.userId).toBe(admin.id);
    expect((log?.after as { name: string }).name).toBe("Audited Client");
  });

  it("the audit log is append-only", async () => {
    const log = await db.auditLog.findFirstOrThrow();
    await expect(db.auditLog.update({ where: { id: log.id }, data: { action: "TAMPERED" } })).rejects.toThrow(/append-only/);
    await expect(db.auditLog.delete({ where: { id: log.id } })).rejects.toThrow(/append-only/);
  });
});

describe("financial record protection", () => {
  it("cannot hard-delete a client payment; voiding is audited and freezes the record", async () => {
    const project = await makeProject(admin.id);
    const payment = await as(admin.id, (tx) =>
      tx.clientPayment.create({
        data: { projectId: project.id, amount: 100000, date: day("2026-02-01"), method: "CASH", createdById: "forged-id" },
      }),
    );
    // createdById is stamped from the acting user, not trusted from the caller.
    expect(payment.createdById).toBe(admin.id);

    await expect(as(admin.id, (tx) => tx.clientPayment.delete({ where: { id: payment.id } }))).rejects.toThrow(/cannot be deleted/);

    // Void requires a reason (CHECK constraint).
    await expect(
      as(admin.id, (tx) => tx.clientPayment.update({ where: { id: payment.id }, data: { voidedAt: new Date() } })),
    ).rejects.toThrow(/void_reason_chk/);

    const voided = await as(admin.id, (tx) =>
      tx.clientPayment.update({ where: { id: payment.id }, data: { voidedAt: new Date(), voidReason: "Entered twice" } }),
    );
    expect(voided.voidedById).toBe(admin.id);
    const log = await db.auditLog.findFirst({ where: { entityId: payment.id, action: "VOID" } });
    expect(log).not.toBeNull();

    await expect(
      as(admin.id, (tx) => tx.clientPayment.update({ where: { id: payment.id }, data: { amount: 5 } })),
    ).rejects.toThrow(/cannot be modified/);
  });

  it("rejects zero or negative amounts", async () => {
    const project = await makeProject(admin.id);
    await expect(
      as(admin.id, (tx) =>
        tx.expense.create({
          data: {
            projectId: project.id, categoryId: "missing", amount: -5, date: day("2026-02-01"),
            paidTo: "x", method: "CASH", createdById: admin.id,
          },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      as(admin.id, (tx) =>
        tx.partnerWithdrawal.create({
          data: { projectId: project.id, partnerId: "missing", amount: 0, date: day("2026-02-01"), method: "CASH", createdById: admin.id },
        }),
      ),
    ).rejects.toThrow(/amount_chk/);
  });

  it("projects cannot be deleted", async () => {
    const project = await makeProject(admin.id);
    await expect(as(admin.id, (tx) => tx.project.delete({ where: { id: project.id } }))).rejects.toThrow(/cannot be deleted/);
  });
});

describe("project type rules", () => {
  it("commission projects require a commission percentage between 0 and 100", async () => {
    await expect(makeProject(admin.id, { type: "COMMISSION" })).rejects.toThrow(/commission_chk/);
    await expect(makeProject(admin.id, { type: "COMMISSION", commissionPercent: 150 })).rejects.toThrow(/commission_chk/);
    const p = await makeProject(admin.id, { type: "COMMISSION", commissionPercent: 12 });
    expect(p.commissionPercent?.toString()).toBe("12");
  });

  it("non-commission projects cannot carry a commission percentage", async () => {
    await expect(makeProject(admin.id, { type: "LABOUR_RATE", commissionPercent: 10 })).rejects.toThrow(/commission_chk/);
  });
});

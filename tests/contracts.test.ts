import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, day, db, dbRead, makeProject, makeUsers, uniq } from "./helpers";
import { toActionError } from "@/lib/mutation";

let adminId: string;
beforeAll(async () => {
  adminId = (await makeUsers()).admin.id;
});
afterAll(async () => {
  await db.$disconnect();
  await dbRead.$disconnect();
});

async function setup(amount = 1_000_000) {
  const project = await makeProject(adminId);
  return as(adminId, async (tx) => {
    const contractor = await tx.contractor.create({ data: { name: uniq("Contractor"), phone: "0300" } });
    const contract = await tx.contract.create({
      data: { projectId: project.id, contractorId: contractor.id, title: "Labour", contractAmount: amount, startDate: day("2026-01-01"), createdById: adminId },
    });
    return { project, contractor, contract };
  });
}
const payment = (contractId: string, projectId: string, amount: number) =>
  as(adminId, (tx) =>
    tx.contractorPayment.create({
      data: { contractId, projectId, type: "INSTALLMENT", amount, date: day("2026-02-01"), method: "CASH", createdById: adminId },
    }),
  );
const balance = async (contractId: string) =>
  (await dbRead.$queryRaw<Record<string, { toFixed(n: number): string }>[]>`SELECT * FROM "ContractBalance" WHERE "contractId" = ${contractId}`)[0];

describe("contract rules", () => {
  it("overpayment shows as overpaid, not negative outstanding", async () => {
    const { project, contract } = await setup(100_000);
    await payment(contract.id, project.id, 120_000);
    const b = await balance(contract.id);
    expect(b.outstanding.toFixed(2)).toBe("0.00");
    expect(b.overpaid.toFixed(2)).toBe("20000.00");
  });

  it("a contract cannot be moved to another project", async () => {
    const { contract } = await setup();
    const other = await makeProject(adminId);
    await expect(as(adminId, (tx) => tx.contract.update({ where: { id: contract.id }, data: { projectId: other.id } }))).rejects.toThrow(
      /projectId cannot be changed/,
    );
  });

  it("a payment cannot be moved to another contract", async () => {
    const a = await setup();
    const p = await payment(a.contract.id, a.project.id, 1000);
    const k2 = await as(adminId, (tx) =>
      tx.contract.create({
        data: { projectId: a.project.id, contractorId: a.contractor.id, title: "Second", contractAmount: 5000, startDate: day("2026-01-01"), createdById: adminId },
      }),
    );
    await expect(as(adminId, (tx) => tx.contractorPayment.update({ where: { id: p.id }, data: { contractId: k2.id } }))).rejects.toThrow(
      /contractId cannot be changed/,
    );
  });

  it("the contractor cannot be swapped once payments exist", async () => {
    const { project, contract } = await setup();
    const c2 = await as(adminId, (tx) => tx.contractor.create({ data: { name: uniq("Other"), phone: "1" } }));
    // Allowed before any payment.
    await as(adminId, (tx) => tx.contract.update({ where: { id: contract.id }, data: { contractorId: c2.id } }));
    await payment(contract.id, project.id, 1000);
    const c3 = await as(adminId, (tx) => tx.contractor.create({ data: { name: uniq("Third"), phone: "1" } }));
    await expect(as(adminId, (tx) => tx.contract.update({ where: { id: contract.id }, data: { contractorId: c3.id } }))).rejects.toThrow(
      /contractor cannot be changed/,
    );
  });

  it("a contract with active payments cannot be voided; once they are voided it can", async () => {
    const { project, contract } = await setup();
    const p = await payment(contract.id, project.id, 1000);
    const voidContract = () =>
      as(adminId, (tx) => tx.contract.update({ where: { id: contract.id }, data: { voidedAt: new Date(), voidReason: "Mistake" } }));
    await expect(voidContract()).rejects.toThrow(/active payments or adjustments/);
    await as(adminId, (tx) => tx.contractorPayment.update({ where: { id: p.id }, data: { voidedAt: new Date(), voidReason: "Mistake" } }));
    await voidContract();
    // And nothing new can be paid on it.
    await expect(payment(contract.id, project.id, 10)).rejects.toThrow(/contract is voided/);
    expect(await balance(contract.id)).toBeUndefined(); // voided contracts leave the balances
  });

  it("the same work category cannot be listed twice on a contract", async () => {
    const { contract } = await setup();
    const wc = await as(adminId, (tx) => tx.workCategory.create({ data: { name: uniq("Plaster") } }));
    await as(adminId, (tx) => tx.contractScopeItem.create({ data: { contractId: contract.id, workCategoryId: wc.id, included: true } }));
    await expect(
      as(adminId, (tx) => tx.contractScopeItem.create({ data: { contractId: contract.id, workCategoryId: wc.id, included: false } })),
    ).rejects.toThrow();
  });

  it("contractor payments appear in the project cash ledger exactly once", async () => {
    const { project, contract } = await setup();
    await payment(contract.id, project.id, 40_000);
    await as(adminId, (tx) =>
      tx.contractAdjustment.create({ data: { contractId: contract.id, type: "EXTRA", amount: 9999, date: day("2026-02-02"), reason: "x", createdById: adminId } }),
    );
    const rows = await dbRead.$queryRaw<{ n: bigint; out: { toFixed(n: number): string } }[]>`
      SELECT count(*) AS n, sum("outflow") AS out FROM "ProjectCashLedger" WHERE "projectId" = ${project.id}`;
    expect(Number(rows[0].n)).toBe(1); // the adjustment is not cash
    expect(rows[0].out.toFixed(2)).toBe("40000.00");
  });
});

describe("database rule messages reach the user", () => {
  it("maps trigger errors to readable messages", async () => {
    const { contract } = await setup();
    const other = await makeProject(adminId);
    const err = await as(adminId, (tx) => tx.contract.update({ where: { id: contract.id }, data: { projectId: other.id } })).catch((e) => e);
    const r = toActionError(err);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/^Contract\.projectId cannot be changed; void the record and enter it again\.$/);
  });
});

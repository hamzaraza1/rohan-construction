import "server-only";
import { Prisma } from "@prisma/client";
import { dbRead } from "@/lib/db";

type Dec = Prisma.Decimal;

export type ContractBalanceRow = {
  contractId: string;
  projectId: string;
  contractorId: string;
  status: string;
  contractAmount: Dec;
  extras: Dec;
  deductions: Dec;
  netPayable: Dec;
  paid: Dec;
  outstanding: Dec;
  overpaid: Dec;
};

const ZERO = new Prisma.Decimal(0);

export async function contractBalances(where: { contractIds?: string[]; projectId?: string; contractorId?: string }) {
  const conds: Prisma.Sql[] = [];
  if (where.contractIds) {
    if (where.contractIds.length === 0) return new Map<string, ContractBalanceRow>();
    conds.push(Prisma.sql`"contractId" IN (${Prisma.join(where.contractIds)})`);
  }
  if (where.projectId) conds.push(Prisma.sql`"projectId" = ${where.projectId}`);
  if (where.contractorId) conds.push(Prisma.sql`"contractorId" = ${where.contractorId}`);
  const rows = await dbRead.$queryRaw<ContractBalanceRow[]>`
    SELECT * FROM "ContractBalance" ${conds.length ? Prisma.sql`WHERE ${Prisma.join(conds, " AND ")}` : Prisma.empty}`;
  return new Map(rows.map((r) => [r.contractId, r]));
}

export function sumBalances(rows: Iterable<ContractBalanceRow>) {
  const t = { netPayable: ZERO, paid: ZERO, outstanding: ZERO, overpaid: ZERO };
  for (const r of rows) {
    t.netPayable = t.netPayable.plus(r.netPayable);
    t.paid = t.paid.plus(r.paid);
    t.outstanding = t.outstanding.plus(r.outstanding);
    t.overpaid = t.overpaid.plus(r.overpaid);
  }
  return t;
}

export async function listContractors(q?: string, archived = false) {
  const contractors = await dbRead.contractor.findMany({
    where: {
      archivedAt: archived ? { not: null } : null,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { specialization: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { contracts: { where: { voidedAt: null }, select: { id: true, status: true } } },
    orderBy: { name: "asc" },
  });
  const balances = await contractBalances({ contractIds: contractors.flatMap((c) => c.contracts.map((k) => k.id)) });
  return contractors.map((c) => ({
    ...c,
    activeContracts: c.contracts.filter((k) => k.status === "ACTIVE").length,
    totals: sumBalances(c.contracts.map((k) => balances.get(k.id)!).filter(Boolean)),
  }));
}

export async function getContractor(id: string) {
  const contractor = await dbRead.contractor.findUnique({
    where: { id },
    include: {
      contracts: {
        orderBy: [{ voidedAt: { sort: "asc", nulls: "first" } }, { startDate: "desc" }],
        include: { project: { select: { id: true, name: true } } },
      },
    },
  });
  if (!contractor) return null;
  const balances = await contractBalances({ contractorId: id });
  return { ...contractor, balances, totals: sumBalances(balances.values()) };
}

export async function listContractsForProject(projectId: string) {
  const contracts = await dbRead.contract.findMany({
    where: { projectId },
    orderBy: [{ voidedAt: { sort: "asc", nulls: "first" } }, { startDate: "desc" }],
    include: { contractor: { select: { id: true, name: true, specialization: true } } },
  });
  const balances = await contractBalances({ projectId });
  return { contracts, balances, totals: sumBalances(balances.values()) };
}

export async function getContract(id: string) {
  const contract = await dbRead.contract.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true, archivedAt: true, client: { select: { name: true } } } },
      contractor: true,
      scopeItems: { include: { workCategory: true }, orderBy: { workCategory: { sortOrder: "asc" } } },
      adjustments: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
      payments: {
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        include: { attachment: { select: { id: true, originalName: true } } },
      },
    },
  });
  if (!contract) return null;
  const balance = (await contractBalances({ contractIds: [id] })).get(id) ?? null;
  return { ...contract, balance };
}

export async function listContractorPayments(where: Prisma.ContractorPaymentWhereInput, take = 500) {
  return dbRead.contractorPayment.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
    include: {
      attachment: { select: { id: true, originalName: true } },
      contract: { select: { id: true, title: true, contractor: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } } },
    },
  });
}

export async function workCategoryOptions() {
  return dbRead.workCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, isActive: true } });
}

export async function contractorOptions() {
  return dbRead.contractor.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, specialization: true },
  });
}

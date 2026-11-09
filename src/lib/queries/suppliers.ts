import "server-only";
import { Prisma } from "@prisma/client";
import { dbRead } from "@/lib/db";

type Dec = Prisma.Decimal;
const ZERO = new Prisma.Decimal(0);

export type SupplierAccountRow = {
  projectId: string;
  supplierId: string;
  orderedValue: Dec;
  receivedValue: Dec;
  paid: Dec;
  advanceBalance: Dec;
  outstandingPayable: Dec;
  undeliveredValue: Dec;
};

export async function supplierAccounts(where: { projectId?: string; supplierId?: string }) {
  const conds: Prisma.Sql[] = [];
  if (where.projectId) conds.push(Prisma.sql`"projectId" = ${where.projectId}`);
  if (where.supplierId) conds.push(Prisma.sql`"supplierId" = ${where.supplierId}`);
  return dbRead.$queryRaw<SupplierAccountRow[]>`
    SELECT * FROM "SupplierAccount" ${conds.length ? Prisma.sql`WHERE ${Prisma.join(conds, " AND ")}` : Prisma.empty}`;
}

export function sumAccounts(rows: SupplierAccountRow[]) {
  const t = { orderedValue: ZERO, receivedValue: ZERO, paid: ZERO, advanceBalance: ZERO, outstandingPayable: ZERO, undeliveredValue: ZERO };
  for (const r of rows) for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] = t[k].plus(r[k]);
  return t;
}

export async function getSupplierAccount(projectId: string, supplierId: string) {
  const [row] = await supplierAccounts({ projectId, supplierId });
  return row ?? null;
}

export async function listSuppliers(q?: string, archived = false) {
  const suppliers = await dbRead.supplier.findMany({
    where: {
      archivedAt: archived ? { not: null } : null,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { categories: { some: { name: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    include: { categories: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
  const accounts = await supplierAccounts({});
  const bySupplier = new Map<string, SupplierAccountRow[]>();
  for (const a of accounts) bySupplier.set(a.supplierId, [...(bySupplier.get(a.supplierId) ?? []), a]);
  return suppliers.map((s) => ({ ...s, totals: sumAccounts(bySupplier.get(s.id) ?? []) }));
}

export async function getSupplier(id: string) {
  const supplier = await dbRead.supplier.findUnique({
    where: { id },
    include: { categories: { select: { id: true, name: true } } },
  });
  if (!supplier) return null;
  const accounts = await supplierAccounts({ supplierId: id });
  const projects = await dbRead.project.findMany({
    where: { id: { in: accounts.map((a) => a.projectId) } },
    select: { id: true, name: true },
  });
  const names = new Map(projects.map((p) => [p.id, p.name]));
  return {
    ...supplier,
    accounts: accounts.map((a) => ({ ...a, projectName: names.get(a.projectId) ?? "?" })),
    totals: sumAccounts(accounts),
  };
}

export type PoListRow = Awaited<ReturnType<typeof listPurchaseOrders>>[number];

export async function listPurchaseOrders(where: Prisma.PurchaseOrderWhereInput) {
  const pos = await dbRead.purchaseOrder.findMany({
    where,
    orderBy: [{ orderDate: "desc" }, { orderNumber: "desc" }],
    include: {
      supplier: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      lines: { select: { quantity: true, rate: true } },
    },
  });
  const balances = pos.length
    ? await dbRead.$queryRaw<{ purchaseOrderId: string; receivedValue: Dec; undeliveredValue: Dec }[]>`
        SELECT "purchaseOrderId", sum("receivedValue") AS "receivedValue", sum("undeliveredValue") AS "undeliveredValue"
        FROM "PurchaseOrderLineBalance" WHERE "purchaseOrderId" IN (${Prisma.join(pos.map((p) => p.id))})
        GROUP BY "purchaseOrderId"`
    : [];
  const paid = pos.length
    ? await dbRead.supplierPayment.groupBy({
        by: ["purchaseOrderId"],
        where: { purchaseOrderId: { in: pos.map((p) => p.id) }, voidedAt: null },
        _sum: { amount: true },
      })
    : [];
  const bal = new Map(balances.map((b) => [b.purchaseOrderId, b]));
  const paidMap = new Map(paid.map((p) => [p.purchaseOrderId, p._sum.amount ?? ZERO]));
  return pos.map((po) => ({
    ...po,
    orderedValue: po.lines.reduce((a, l) => a.plus(l.quantity.mul(l.rate).toDecimalPlaces(2)), ZERO),
    receivedValue: bal.get(po.id)?.receivedValue ?? ZERO,
    undeliveredValue: bal.get(po.id)?.undeliveredValue ?? ZERO,
    paidAgainst: paidMap.get(po.id) ?? ZERO,
  }));
}

export async function getPurchaseOrder(id: string) {
  const po = await dbRead.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      project: { select: { id: true, name: true, archivedAt: true } },
      lines: { include: { material: { select: { id: true, name: true, unit: true } } } },
      receipts: { orderBy: { receiptDate: "desc" }, include: { lines: { select: { quantity: true, rate: true } } } },
      payments: { orderBy: { date: "desc" }, include: { attachment: { select: { id: true, originalName: true } } } },
    },
  });
  if (!po) return null;
  const lineBalances = await dbRead.$queryRaw<{ poLineId: string; receivedQty: Dec; receivedValue: Dec; undeliveredValue: Dec }[]>`
    SELECT "poLineId", "receivedQty", "receivedValue", "undeliveredValue" FROM "PurchaseOrderLineBalance" WHERE "purchaseOrderId" = ${id}`;
  // Cancelled orders have no balance rows: fall back to zero received.
  const lb = new Map(lineBalances.map((l) => [l.poLineId, l]));
  const lines = po.lines.map((l) => {
    const b = lb.get(l.id);
    const ordered = l.quantity.mul(l.rate).toDecimalPlaces(2);
    const receivedQty = b?.receivedQty ?? ZERO;
    return {
      ...l,
      orderedValue: ordered,
      receivedQty,
      receivedValue: b?.receivedValue ?? ZERO,
      remainingQty: Prisma.Decimal.max(l.quantity.minus(receivedQty), 0),
      undeliveredValue: b?.undeliveredValue ?? ZERO,
    };
  });
  return { ...po, lines };
}

export async function listReceipts(where: Prisma.MaterialReceiptWhereInput, take = 300) {
  const rows = await dbRead.materialReceipt.findMany({
    where,
    orderBy: [{ receiptDate: "desc" }, { createdAt: "desc" }],
    take,
    include: {
      supplier: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      purchaseOrder: { select: { id: true, orderNumber: true } },
      lines: { include: { material: { select: { name: true, unit: true } } } },
      attachment: { select: { id: true, originalName: true } },
    },
  });
  return rows.map((r) => ({ ...r, value: r.lines.reduce((a, l) => a.plus(l.quantity.mul(l.rate).toDecimalPlaces(2)), ZERO) }));
}

export async function listSupplierPayments(where: Prisma.SupplierPaymentWhereInput, take = 300) {
  return dbRead.supplierPayment.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
    include: {
      supplier: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      purchaseOrder: { select: { id: true, orderNumber: true } },
      attachment: { select: { id: true, originalName: true } },
    },
  });
}

export async function supplierOptions() {
  return dbRead.supplier.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

export async function supplierCategoryOptions() {
  return dbRead.supplierCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, isActive: true } });
}

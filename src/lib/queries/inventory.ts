import "server-only";
import { Prisma } from "@prisma/client";
import { dbRead } from "@/lib/db";

type Dec = Prisma.Decimal;

export type StockRow = {
  projectId: string;
  materialId: string;
  materialName: string;
  unit: string;
  categoryName: string;
  orderedQty: Dec;
  receivedQty: Dec;
  receivedValue: Dec;
  issuedQty: Dec;
  wastedQty: Dec;
  adjustedQty: Dec;
  onHandQty: Dec;
  avgRate: Dec;
  stockValue: Dec;
};

export async function getProjectStock(projectId: string): Promise<StockRow[]> {
  return dbRead.$queryRaw<StockRow[]>`
    SELECT s.*, m."name" AS "materialName", m."unit", c."name" AS "categoryName"
    FROM "ProjectStock" s
    JOIN "Material" m ON m."id" = s."materialId"
    JOIN "MaterialCategory" c ON c."id" = m."categoryId"
    WHERE s."projectId" = ${projectId}
    ORDER BY c."sortOrder", c."name", m."name"`;
}

/** Stock value per project (for the Inventory overview). */
export async function stockByProject() {
  return dbRead.$queryRaw<{ projectId: string; projectName: string; materials: number; stockValue: Dec; receivedValue: Dec }[]>`
    SELECT p."id" AS "projectId", p."name" AS "projectName",
           count(*) FILTER (WHERE s."onHandQty" > 0)::int AS materials,
           coalesce(sum(s."stockValue"), 0) AS "stockValue",
           coalesce(sum(s."receivedValue"), 0) AS "receivedValue"
    FROM "Project" p
    LEFT JOIN "ProjectStock" s ON s."projectId" = p."id"
    WHERE p."archivedAt" IS NULL
    GROUP BY p."id", p."name"
    ORDER BY p."name"`;
}

export async function listStockMovements(projectId: string, take = 300) {
  return dbRead.stockMovement.findMany({
    where: { projectId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
    include: { material: { select: { name: true, unit: true } } },
  });
}

export async function materialOptions() {
  return dbRead.material.findMany({
    where: { isActive: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    select: { id: true, name: true, unit: true, category: { select: { name: true } } },
  });
}

export async function listMaterials() {
  return dbRead.material.findMany({
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    include: { category: { select: { id: true, name: true } }, _count: { select: { receiptLines: true, poLines: true, stockMovements: true } } },
  });
}

export async function materialCategoryOptions() {
  return dbRead.materialCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
}

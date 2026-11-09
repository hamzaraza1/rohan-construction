import "server-only";
import type { Tx } from "@/lib/mutation";

export const CATEGORY_KINDS = {
  expense: {
    title: "Expense categories",
    singular: "expense category",
    description: "Categories used when recording project expenses. System categories are filled automatically and cannot be removed.",
  },
  material: {
    title: "Material categories",
    singular: "material category",
    description: "Groups for inventory materials (cement, steel, electrical …).",
  },
  work: {
    title: "Contractor work categories",
    singular: "work category",
    description: "Work scopes that can be included in or excluded from contractor contracts.",
  },
  supplier: {
    title: "Supplier categories",
    singular: "supplier category",
    description: "What each supplier supplies.",
  },
} as const;

export type CategoryKind = keyof typeof CATEGORY_KINDS;
export const isCategoryKind = (k: string): k is CategoryKind => k in CATEGORY_KINDS;

export type CategoryRow = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  isMiscellaneous?: boolean;
  systemKey?: string | null;
  usage: number;
};

type Delegate = {
  findMany(args: object): Promise<Array<Record<string, unknown>>>;
  findUniqueOrThrow(args: object): Promise<Record<string, unknown>>;
  create(args: object): Promise<unknown>;
  update(args: object): Promise<unknown>;
  delete(args: object): Promise<unknown>;
  aggregate(args: object): Promise<{ _max: { sortOrder: number | null } }>;
};

type Client = Pick<Tx, "expenseCategory" | "materialCategory" | "workCategory" | "supplierCategory">;

/** Category tables differ only in their name and usage relation. */
export function categoryDelegate(client: Client, kind: CategoryKind): { model: Delegate; usageRelation: string } {
  switch (kind) {
    case "expense":
      return { model: client.expenseCategory as unknown as Delegate, usageRelation: "expenses" };
    case "material":
      return { model: client.materialCategory as unknown as Delegate, usageRelation: "materials" };
    case "work":
      return { model: client.workCategory as unknown as Delegate, usageRelation: "scopeItems" };
    case "supplier":
      return { model: client.supplierCategory as unknown as Delegate, usageRelation: "suppliers" };
  }
}

export async function listCategories(client: Client, kind: CategoryKind): Promise<CategoryRow[]> {
  const { model, usageRelation } = categoryDelegate(client, kind);
  const rows = await model.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { [usageRelation]: true } } },
  });
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    isActive: r.isActive as boolean,
    sortOrder: r.sortOrder as number,
    isMiscellaneous: r.isMiscellaneous as boolean | undefined,
    systemKey: r.systemKey as string | null | undefined,
    usage: (r._count as Record<string, number>)[usageRelation],
  }));
}

/**
 * Idempotent seed: first admin user, the admin's partner record and default
 * categories. Safe to run more than once — existing rows are left untouched.
 *
 *   SEED_ADMIN_NAME=Hamza SEED_ADMIN_USERNAME=hamza SEED_ADMIN_PASSWORD='...' npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();

const EXPENSE_CATEGORIES: { name: string; systemKey?: string; isMiscellaneous?: boolean }[] = [
  { name: "Material Purchase" },
  { name: "Labour Wages" },
  { name: "Contractor Payment", systemKey: "CONTRACTOR_PAYMENT" },
  { name: "Transportation" },
  { name: "Machinery / Equipment" },
  { name: "Site Utilities" },
  { name: "Food / Refreshments" },
  { name: "Miscellaneous / Irregular Expenses", isMiscellaneous: true },
];
const MATERIAL_CATEGORIES = ["Cement", "Steel", "Sand", "Crush", "Bricks", "Tiles", "Paint", "Electrical", "Plumbing", "Other"];
const WORK_CATEGORIES = [
  "Excavation", "Foundation", "Brickwork", "Plaster", "Tiles", "Electrical", "Plumbing", "Paint",
  "False Ceiling", "Woodwork", "Aluminium and Windows", "Other",
];
const SUPPLIER_CATEGORIES = ["Cement", "Steel", "Sand & Crush", "Bricks", "Tiles", "Paint", "Electrical", "Plumbing", "Hardware", "Other"];

async function main() {
  const name = process.env.SEED_ADMIN_NAME ?? "Hamza";
  const username = (process.env.SEED_ADMIN_USERNAME ?? "hamza").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  let admin = await prisma.user.findUnique({ where: { username } });
  if (!admin) {
    if (!password || password.length < 10) {
      throw new Error("Set SEED_ADMIN_PASSWORD (at least 10 characters) to create the first admin user.");
    }
    admin = await prisma.user.create({
      data: {
        name,
        username,
        role: "ADMIN",
        passwordHash: await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 }),
      },
    });
    console.log(`Created admin user "${username}".`);
  } else {
    console.log(`Admin user "${username}" already exists — not modified.`);
  }

  await prisma.$transaction(async (tx) => {
    // Database triggers require an acting admin for writes to business tables.
    await tx.$executeRaw`SELECT set_config('app.user_id', ${admin.id}, true)`;

    for (const [i, c] of EXPENSE_CATEGORIES.entries()) {
      const existing = await tx.expenseCategory.findUnique({ where: { name: c.name } });
      if (!existing) {
        await tx.expenseCategory.create({
          data: { name: c.name, systemKey: c.systemKey, isMiscellaneous: c.isMiscellaneous ?? false, sortOrder: i + 1 },
        });
      }
    }
    const simple = [
      [tx.materialCategory, MATERIAL_CATEGORIES],
      [tx.workCategory, WORK_CATEGORIES],
      [tx.supplierCategory, SUPPLIER_CATEGORIES],
    ] as const;
    for (const [model, names] of simple) {
      for (const [i, n] of names.entries()) {
        const m = model as any;
        if (!(await m.findUnique({ where: { name: n } }))) await m.create({ data: { name: n, sortOrder: i + 1 } });
      }
    }

    if (!(await tx.partner.findUnique({ where: { userId: admin.id } })) && !(await tx.partner.findUnique({ where: { name } }))) {
      await tx.partner.create({ data: { name, userId: admin.id, sortOrder: 0 } });
    }
  }, { timeout: 30_000 });

  console.log("Default categories and partner ensured.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

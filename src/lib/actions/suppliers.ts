"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminMutation, toActionError, UserFacingError, type ActionResult } from "@/lib/mutation";
import { checkbox, formFields, optionalText, requiredText } from "@/lib/validation";

const supplierSchema = z.object({
  name: requiredText(150),
  phone: z.string().trim().min(5, "Enter a contact number").max(40).regex(/^[0-9+()\-\s]+$/, "Digits, spaces, + ( ) - only"),
  address: optionalText(300),
  notes: optionalText(1000),
});

const categoryIds = (fd: FormData) => fd.getAll("categoryIds").filter((v): v is string => typeof v === "string" && v !== "");

export async function createSupplier(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const data = supplierSchema.parse(formFields(fd));
    const cats = categoryIds(fd);
    id = (await adminMutation((tx) => tx.supplier.create({ data: { ...data, categories: { connect: cats.map((c) => ({ id: c })) } } }))).id;
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/suppliers");
  const back = fd.get("returnTo");
  redirect(typeof back === "string" && back.startsWith("/") && !back.startsWith("//") ? `${back}${back.includes("?") ? "&" : "?"}supplierId=${id}` : `/suppliers/${id}`);
}

export async function updateSupplier(id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const data = supplierSchema.parse(formFields(fd));
    const cats = categoryIds(fd);
    await adminMutation((tx) => tx.supplier.update({ where: { id }, data: { ...data, categories: { set: cats.map((c) => ({ id: c })) } } }));
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/suppliers");
  redirect(`/suppliers/${id}`);
}

export async function setSupplierArchived(id: string, archived: boolean): Promise<ActionResult> {
  try {
    await adminMutation((tx) => tx.supplier.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } }));
    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${id}`);
    return { ok: true, message: archived ? "Supplier archived." : "Supplier restored." };
  } catch (err) {
    return toActionError(err);
  }
}

// -----------------------------------------------------------------------------
// Material catalogue
// -----------------------------------------------------------------------------

const materialSchema = z.object({
  name: requiredText(120),
  unit: requiredText(20),
  categoryId: z.string().min(1, "Choose a category"),
  isActive: checkbox,
});

export async function createMaterial(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const { isActive: _a, ...data } = materialSchema.parse(formFields(fd));
    void _a;
    await adminMutation((tx) => tx.material.create({ data }));
    revalidatePath("/inventory/materials");
    return { ok: true, message: `"${data.name}" added.` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateMaterial(id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const data = materialSchema.parse(formFields(fd));
    await adminMutation(async (tx) => {
      const m = await tx.material.findUnique({ where: { id } });
      if (!m) throw new UserFacingError("Material not found.");
      await tx.material.update({ where: { id }, data });
    });
    revalidatePath("/inventory/materials");
    return { ok: true, message: "Saved." };
  } catch (err) {
    return toActionError(err);
  }
}

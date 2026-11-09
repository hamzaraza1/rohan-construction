"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminMutation, toActionError, type ActionResult } from "@/lib/mutation";
import { formFields, optionalText, requiredText } from "@/lib/validation";

const schema = z.object({
  name: requiredText(150),
  phone: z.string().trim().min(5, "Enter a phone number").max(40).regex(/^[0-9+()\-\s]+$/, "Digits, spaces, + ( ) - only"),
  address: optionalText(300),
  specialization: optionalText(150),
  notes: optionalText(1000),
});

export async function createContractor(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const data = schema.parse(formFields(fd));
    id = (await adminMutation((tx) => tx.contractor.create({ data }))).id;
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/contractors");
  const back = fd.get("returnTo");
  redirect(typeof back === "string" && back.startsWith("/contracts/new") ? `${back}&contractorId=${id}` : `/contractors/${id}`);
}

export async function updateContractor(id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const data = schema.parse(formFields(fd));
    await adminMutation((tx) => tx.contractor.update({ where: { id }, data }));
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/contractors");
  redirect(`/contractors/${id}`);
}

export async function setContractorArchived(id: string, archived: boolean): Promise<ActionResult> {
  try {
    await adminMutation((tx) => tx.contractor.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } }));
    revalidatePath("/contractors");
    revalidatePath(`/contractors/${id}`);
    return { ok: true, message: archived ? "Contractor archived." : "Contractor restored." };
  } catch (err) {
    return toActionError(err);
  }
}

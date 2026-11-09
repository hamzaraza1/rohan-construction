"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminMutation, toActionError, type ActionResult } from "@/lib/mutation";
import { formFields, optionalText, requiredText } from "@/lib/validation";

const clientSchema = z.object({
  name: requiredText(150),
  phone: z.string().trim().min(5, "Enter a phone number").max(40).regex(/^[0-9+()\-\s]+$/, "Digits, spaces, + ( ) - only"),
  email: z
    .union([z.literal(""), z.email("Invalid email")])
    .optional()
    .transform((v) => v || null),
  address: optionalText(300),
  notes: optionalText(1000),
});

export async function createClient(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const data = clientSchema.parse(formFields(fd));
    id = (await adminMutation((tx) => tx.client.create({ data }))).id;
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/clients");
  redirect(fd.get("returnTo") === "project" ? `/projects/new?clientId=${id}` : `/clients/${id}`);
}

export async function updateClient(id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const data = clientSchema.parse(formFields(fd));
    await adminMutation((tx) => tx.client.update({ where: { id }, data }));
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/clients");
  redirect(`/clients/${id}`);
}

export async function setClientArchived(id: string, archived: boolean): Promise<ActionResult> {
  try {
    await adminMutation((tx) => tx.client.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } }));
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    return { ok: true, message: archived ? "Client archived." : "Client restored." };
  } catch (err) {
    return toActionError(err);
  }
}

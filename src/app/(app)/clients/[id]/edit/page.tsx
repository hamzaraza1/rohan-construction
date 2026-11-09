import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guards";
import { dbRead } from "@/lib/db";
import { updateClient } from "@/lib/actions/clients";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ClientForm } from "@/components/domain/ClientForm";

export const metadata: Metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const client = await dbRead.client.findUnique({ where: { id } });
  if (!client) notFound();
  return (
    <>
      <PageHeader title={`Edit ${client.name}`} />
      <Card className="max-w-3xl p-6">
        <ClientForm action={updateClient.bind(null, id)} initial={client} cancelHref={`/clients/${id}`} submitLabel="Save changes" />
      </Card>
    </>
  );
}

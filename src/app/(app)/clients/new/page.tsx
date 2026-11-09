import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/guards";
import { createClient } from "@/lib/actions/clients";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ClientForm } from "@/components/domain/ClientForm";

export const metadata: Metadata = { title: "New client" };

export default async function NewClientPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  await requireAdminPage();
  const { returnTo } = await searchParams;
  const toProject = returnTo === "project";
  return (
    <>
      <PageHeader title="New client" description={toProject ? "After saving you will return to the new project form." : undefined} />
      <Card className="max-w-3xl p-6">
        <ClientForm
          action={createClient}
          cancelHref={toProject ? "/projects/new" : "/clients"}
          submitLabel="Create client"
          returnTo={toProject ? "project" : undefined}
        />
      </Card>
    </>
  );
}

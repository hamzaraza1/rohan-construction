import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/guards";
import { clientOptions } from "@/lib/queries/projects";
import { createProject } from "@/lib/actions/projects";
import { todayPk } from "@/lib/validation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { ProjectForm } from "@/components/domain/ProjectForm";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  await requireAdminPage();
  const { clientId } = await searchParams;
  const clients = await clientOptions();
  return (
    <>
      <PageHeader title="New project" description="The contract type decides how the project's money is tracked." />
      <Card className="max-w-4xl p-6">
        {clients.length === 0 ? (
          <EmptyState
            title="Add a client first"
            description="Every project belongs to a client."
            action={<ButtonLink href="/clients/new?returnTo=project">New client</ButtonLink>}
          />
        ) : (
          <ProjectForm
            action={createProject}
            clients={clients}
            cancelHref="/projects"
            submitLabel="Create project"
            initial={{
              name: "",
              clientId: clientId && clients.some((c) => c.id === clientId) ? clientId : "",
              siteAddress: "",
              type: "WITH_MATERIAL",
              status: "ACTIVE",
              startDate: todayPk(),
              expectedCompletionDate: "",
              description: "",
              commissionPercent: "",
              clientContractAmount: "",
            }}
          />
        )}
      </Card>
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guards";
import { dbRead } from "@/lib/db";
import { clientOptions, getProject } from "@/lib/queries/projects";
import { updateProject } from "@/lib/actions/projects";
import { toDateInput } from "@/lib/validation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ProjectForm } from "@/components/domain/ProjectForm";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const [project, clients, paymentCount] = await Promise.all([
    getProject(id),
    clientOptions(),
    dbRead.clientPayment.count({ where: { projectId: id } }),
  ]);
  if (!project) notFound();
  // Keep the current client selectable even if it has been archived.
  if (!clients.some((c) => c.id === project.clientId)) {
    clients.unshift({ id: project.client.id, name: project.client.name, phone: project.client.phone });
  }
  return (
    <>
      <PageHeader title={`Edit ${project.name}`} description="Changes are recorded in the audit log." />
      <Card className="max-w-4xl p-6">
        <ProjectForm
          action={updateProject.bind(null, id)}
          clients={clients}
          clientLocked={paymentCount > 0}
          cancelHref={`/projects/${id}`}
          submitLabel="Save changes"
          initial={{
            name: project.name,
            clientId: project.clientId,
            siteAddress: project.siteAddress,
            type: project.type,
            status: project.status,
            startDate: toDateInput(project.startDate),
            expectedCompletionDate: toDateInput(project.expectedCompletionDate),
            description: project.description ?? "",
            commissionPercent: project.commissionPercent?.toString() ?? "",
            clientContractAmount: project.clientContractAmount?.toString() ?? "",
          }}
        />
      </Card>
    </>
  );
}

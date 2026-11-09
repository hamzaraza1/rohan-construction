import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guards";
import { getProject } from "@/lib/queries/projects";
import { contractorOptions, workCategoryOptions } from "@/lib/queries/contractors";
import { createContract } from "@/lib/actions/contracts";
import { todayPk } from "@/lib/validation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ContractForm } from "@/components/domain/ContractForm";

export const metadata: Metadata = { title: "New contract" };

export default async function NewContractPage({ searchParams }: { searchParams: Promise<{ projectId?: string; contractorId?: string }> }) {
  await requireAdminPage();
  const { projectId, contractorId } = await searchParams;
  if (!projectId) notFound();
  const [project, contractors, workCategories] = await Promise.all([getProject(projectId), contractorOptions(), workCategoryOptions()]);
  if (!project) notFound();
  return (
    <>
      <PageHeader title="New contractor contract" description={`${project.name} · ${project.client.name}`} />
      <div className="max-w-5xl">
        {project.archivedAt ? (
          <Card className="p-6 text-sm text-slate-600">This project is archived. Restore it before adding contracts.</Card>
        ) : (
          <Card className="p-6">
            <ContractForm
              action={createContract.bind(null, projectId)}
              contractors={contractors}
              workCategories={workCategories}
              cancelHref={`/projects/${projectId}?tab=contracts`}
              submitLabel="Create contract"
              newContractorHref={`/contractors/new?returnTo=${encodeURIComponent(`/contracts/new?projectId=${projectId}`)}`}
              initial={{
                contractorId: contractorId && contractors.some((c) => c.id === contractorId) ? contractorId : "",
                title: "",
                description: "",
                contractAmount: "",
                startDate: todayPk(),
                endDate: "",
                status: "ACTIVE",
                progressPercent: "0",
                scope: {},
              }}
            />
          </Card>
        )}
      </div>
    </>
  );
}

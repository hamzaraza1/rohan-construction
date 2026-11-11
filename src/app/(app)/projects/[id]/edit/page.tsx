"use client";

import { useParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProjectForm } from "@/components/forms/ProjectForm";
import { ReadOnlyNotice } from "@/components/domain/ReadOnlyNotice";

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { data, canEdit } = useStore();
  const p = data.projects.find((x) => x.id === id);
  if (!p) return <Card><EmptyState title="Project not found" /></Card>;
  return (
    <>
      <PageHeader title={`Edit ${p.name}`} breadcrumbs={[{ label: "Projects", href: "/projects" }, { label: p.code, href: `/projects/${p.id}` }, { label: "Edit" }]} />
      {canEdit ? <ProjectForm key={p.id} project={p} /> : <ReadOnlyNotice />}
    </>
  );
}

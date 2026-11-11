"use client";

import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProjectForm } from "@/components/forms/ProjectForm";
import { ReadOnlyNotice } from "@/components/domain/ReadOnlyNotice";

export default function NewProjectPage() {
  const { canEdit } = useStore();
  return (
    <>
      <PageHeader title="New project" breadcrumbs={[{ label: "Projects", href: "/projects" }, { label: "New" }]} description="Set up a new site. Material, contractors and payments are added from the project page afterwards." />
      {canEdit ? <ProjectForm /> : <ReadOnlyNotice />}
    </>
  );
}

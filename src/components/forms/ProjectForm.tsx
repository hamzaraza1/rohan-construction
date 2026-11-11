"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Info, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { checkAmount, checkDate, clean, parseAmount, required, today, useForm } from "@/lib/form";
import type { Project, ProjectStatus } from "@/lib/types";
import { PROJECT_STATUS_LABELS } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Field";
import { ClientForm } from "./clients";

type F = {
  name: string; code: string; clientId: string; siteAddress: string; city: string; plotSize: string; status: ProjectStatus;
  startDate: string; expectedEndDate: string; contractValue: string; siteEngineer: string; progress: string; description: string;
};

export function ProjectForm({ project }: { project?: Project }) {
  const { data, add, update } = useStore();
  const router = useRouter();
  const toast = useToast();
  const [newClient, setNewClient] = useState(false);

  const nextCode = () => {
    const yy = today().slice(2, 4);
    const used = data.projects.map((p) => p.code.match(new RegExp(`^RC-${yy}(\\d+)$`))?.[1]).filter(Boolean).map(Number);
    return `RC-${yy}${String(Math.max(0, ...used) + 1).padStart(2, "0")}`;
  };

  const f = useForm<F>(
    {
      name: project?.name ?? "", code: project?.code ?? nextCode(), clientId: project?.clientId ?? "", siteAddress: project?.siteAddress ?? "",
      city: project?.city ?? "Lahore", plotSize: project?.plotSize ?? "", status: project?.status ?? "PLANNING", startDate: project?.startDate ?? today(),
      expectedEndDate: project?.expectedEndDate ?? "", contractValue: project ? String(project.contractValue) : "", siteEngineer: project?.siteEngineer ?? "",
      progress: String(project?.progress ?? 0), description: project?.description ?? "",
    },
    (v) =>
      clean({
        name: required(v.name, "Project name"),
        code: required(v.code, "Project code") ?? (data.projects.some((p) => p.code === v.code.trim() && p.id !== project?.id) ? "This code is already used" : undefined),
        clientId: required(v.clientId, "Client"),
        siteAddress: required(v.siteAddress, "Site address"),
        city: required(v.city, "City"),
        startDate: checkDate(v.startDate, { notFuture: false }),
        expectedEndDate: v.expectedEndDate && v.expectedEndDate < v.startDate ? "End date must be after the start date" : undefined,
        contractValue: checkAmount(v.contractValue),
        progress: /^\d+$/.test(v.progress) && Number(v.progress) <= 100 ? undefined : "Enter 0 to 100",
      }),
  );

  const submit = f.handleSubmit((v) => {
    const row = {
      name: v.name.trim(), code: v.code.trim(), clientId: v.clientId, siteAddress: v.siteAddress.trim(), city: v.city.trim(),
      plotSize: v.plotSize.trim() || undefined, status: v.status, startDate: v.startDate, expectedEndDate: v.expectedEndDate || undefined,
      contractValue: parseAmount(v.contractValue), siteEngineer: v.siteEngineer.trim() || undefined, progress: Number(v.progress),
      description: v.description.trim() || undefined,
    };
    if (project) {
      update("projects", project.id, row);
      toast("Project updated");
      router.push(`/projects/${project.id}`);
    } else {
      const id = add("projects", row);
      toast(`Project “${row.name}” created`);
      router.push(`/projects/${id}`);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Card>
        <CardHeader title="Project details" />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Project name" htmlFor="name" required error={f.errors.name} className="sm:col-span-2">
            <Input {...f.bind("name")} placeholder="e.g. DHA Phase 6 Residence" />
          </FormField>
          <FormField label="Project code" htmlFor="code" required error={f.errors.code}>
            <Input {...f.bind("code")} />
          </FormField>
          <FormField label="Client" htmlFor="clientId" required error={f.errors.clientId} className="sm:col-span-2">
            <div className="flex gap-2">
              <Select {...f.bind("clientId")}>
                <option value="">Select client…</option>
                {data.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Button variant="secondary" onClick={() => setNewClient(true)} className="shrink-0"><Plus className="size-4" /> New</Button>
            </div>
          </FormField>
          <FormField label="Status" htmlFor="status">
            <Select {...f.bind("status")}>
              {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>)}
            </Select>
          </FormField>
          <div className="flex items-start gap-2 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2.5 text-sm text-brand-800 sm:col-span-2 lg:col-span-3">
            <Info className="mt-0.5 size-4 shrink-0" />
            All projects are <span className="font-semibold">With Material Contract</span>: the company buys the material and pays the contractors, and the client pays the agreed contract value.
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Site" />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Site address" htmlFor="siteAddress" required error={f.errors.siteAddress} className="sm:col-span-2">
            <Input {...f.bind("siteAddress")} placeholder="Plot 214, Block C, DHA Phase 6" />
          </FormField>
          <FormField label="City" htmlFor="city" required error={f.errors.city}>
            <Input {...f.bind("city")} />
          </FormField>
          <FormField label="Plot size" htmlFor="plotSize">
            <Input {...f.bind("plotSize")} placeholder="e.g. 10 Marla, 1 Kanal" />
          </FormField>
          <FormField label="Site engineer" htmlFor="siteEngineer">
            <Input {...f.bind("siteEngineer")} placeholder="Engr. …" />
          </FormField>
        </div>
      </Card>

      <Card>
        <CardHeader title="Contract & schedule" />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Contract value (Rs.)" htmlFor="contractValue" required error={f.errors.contractValue} hint="Total agreed with the client, including material">
            <Input {...f.bind("contractValue")} inputMode="decimal" placeholder="0" />
          </FormField>
          <FormField label="Start date" htmlFor="startDate" required error={f.errors.startDate}>
            <Input {...f.bind("startDate")} type="date" />
          </FormField>
          <FormField label="Expected completion" htmlFor="expectedEndDate" error={f.errors.expectedEndDate}>
            <Input {...f.bind("expectedEndDate")} type="date" min={f.values.startDate} />
          </FormField>
          <FormField label="Work progress (%)" htmlFor="progress" error={f.errors.progress}>
            <Input {...f.bind("progress")} type="number" min={0} max={100} />
          </FormField>
          <FormField label="Description / scope" htmlFor="description" className="sm:col-span-2 lg:col-span-4">
            <Textarea {...f.bind("description")} rows={3} placeholder="e.g. Double-storey house with basement" />
          </FormField>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <ButtonLink href={project ? `/projects/${project.id}` : "/projects"} variant="secondary">Cancel</ButtonLink>
        <Button type="submit">{project ? "Save changes" : "Create project"}</Button>
      </div>

      {newClient && <ClientForm onClose={() => setNewClient(false)} onSaved={(id) => f.set("clientId", id)} />}
    </form>
  );
}

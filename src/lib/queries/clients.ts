import "server-only";
import { Prisma } from "@prisma/client";
import { dbRead } from "@/lib/db";
import { getSummariesByProject } from "./projects";

export async function listClients(q?: string, archived = false) {
  const clients = await dbRead.client.findMany({
    where: {
      archivedAt: archived ? { not: null } : null,
      ...(q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }] }
        : {}),
    },
    include: { projects: { select: { id: true, status: true } } },
    orderBy: { name: "asc" },
  });
  const summaries = await getSummariesByProject(clients.flatMap((c) => c.projects.map((p) => p.id)));
  return clients.map((c) => {
    let received = new Prisma.Decimal(0);
    let due = new Prisma.Decimal(0);
    for (const p of c.projects) {
      const s = summaries.get(p.id);
      if (!s) continue;
      received = received.plus(s.clientReceipts);
      if (s.clientAmountDue && s.clientAmountDue.greaterThan(0)) due = due.plus(s.clientAmountDue);
    }
    return {
      ...c,
      projectCount: c.projects.length,
      activeProjects: c.projects.filter((p) => p.status === "ACTIVE").length,
      received,
      due,
    };
  });
}

export async function getClient(id: string) {
  const client = await dbRead.client.findUnique({
    where: { id },
    include: {
      projects: {
        orderBy: { startDate: "desc" },
        select: { id: true, name: true, type: true, status: true, startDate: true, archivedAt: true, siteAddress: true },
      },
    },
  });
  if (!client) return null;
  const summaries = await getSummariesByProject(client.projects.map((p) => p.id));
  return { ...client, projects: client.projects.map((p) => ({ ...p, summary: summaries.get(p.id)! })) };
}

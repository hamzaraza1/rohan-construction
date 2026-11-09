import type { Metadata } from "next";
import { dbRead } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Field";
import { Button, ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 50;
const IGNORED = new Set(["updatedAt", "updatedById", "createdAt", "createdById"]);

function changedFields(before: unknown, after: unknown): string[] {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return [];
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  return Object.keys(a).filter((k) => !IGNORED.has(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

const actionTone = (a: string) =>
  a === "INSERT" || a.endsWith("CREATED") ? "green" : a === "VOID" || a === "DELETE" || a === "LOGIN_FAILED" ? "red" : a.startsWith("LOG") ? "slate" : "blue";

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const entity = sp.entity || undefined;

  const [entries, entityTypes] = await Promise.all([
    dbRead.auditLog.findMany({
      where: entity ? { entityType: entity } : undefined,
      orderBy: { id: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      include: { user: { select: { name: true } } },
    }),
    dbRead.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);
  const hasNext = entries.length > PAGE_SIZE;
  const rows = entries.slice(0, PAGE_SIZE);
  const qs = (p: number) => `?${new URLSearchParams({ ...(entity ? { entity } : {}), page: String(p) })}`;

  return (
    <Card>
      <CardHeader
        title="Audit log"
        description="Append-only record of every change to business data, plus sign-ins and user administration. Entries cannot be edited or deleted."
        actions={
          <form className="flex gap-2">
            <Select name="entity" defaultValue={entity ?? ""} className="w-52" aria-label="Filter by record type">
              <option value="">All record types</option>
              {entityTypes.map((e) => (
                <option key={e.entityType} value={e.entityType}>{e.entityType}</option>
              ))}
            </Select>
            <Button type="submit" variant="secondary">Filter</Button>
          </form>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No audit entries" />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>When</TH>
              <TH>User</TH>
              <TH>Action</TH>
              <TH>Record</TH>
              <TH>Details</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((r) => {
              const fields = r.action === "UPDATE" || r.action === "VOID" || r.action.endsWith("UPDATED") ? changedFields(r.before, r.after) : [];
              const after = (r.after ?? r.before) as Record<string, unknown> | null;
              const label = after && typeof after === "object" ? (after.name ?? after.username ?? after.title ?? "") : "";
              return (
                <TR key={String(r.id)}>
                  <TD className="whitespace-nowrap">{formatDateTime(r.createdAt)}</TD>
                  <TD>{r.user?.name ?? <span className="text-slate-400">system</span>}</TD>
                  <TD><Badge tone={actionTone(r.action)}>{r.action}</Badge></TD>
                  <TD>
                    <span className="font-medium">{r.entityType}</span>
                    {label ? <span className="text-slate-500"> · {String(label)}</span> : null}
                  </TD>
                  <TD className="max-w-md text-xs whitespace-normal text-slate-500">
                    {fields.length > 0 ? `Changed: ${fields.join(", ")}` : r.ip ? `IP ${r.ip}` : ""}
                    {r.action === "VOID" && after?.voidReason ? ` — Reason: ${String(after.voidReason)}` : ""}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm">
        <span className="text-slate-500">Page {page}</span>
        <div className="flex gap-2">
          {page > 1 && <ButtonLink href={qs(page - 1)} variant="secondary" size="sm">Previous</ButtonLink>}
          {hasNext && <ButtonLink href={qs(page + 1)} variant="secondary" size="sm">Next</ButtonLink>}
        </div>
      </div>
    </Card>
  );
}

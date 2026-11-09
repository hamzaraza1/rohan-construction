import { dbRead } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbRead.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "db_unavailable" }, { status: 503 });
  }
}

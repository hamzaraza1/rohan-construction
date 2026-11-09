import { readFile } from "node:fs/promises";
import { dbRead } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { storedPath } from "@/lib/attachments";

export const dynamic = "force-dynamic";

/** Serves an uploaded bill/receipt to signed-in users only. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const att = await dbRead.attachment.findUnique({ where: { id } });
  if (!att) return new Response("Not found", { status: 404 });

  let body: Buffer;
  try {
    body = await readFile(storedPath(att.storedName));
  } catch {
    return new Response("File missing from storage", { status: 410 });
  }
  const download = new URL(req.url).searchParams.has("download");
  const disposition = `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(att.originalName)}`;
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": att.mimeType,
      "Content-Length": String(body.length),
      "Content-Disposition": disposition,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}

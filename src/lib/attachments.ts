import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Tx } from "@/lib/mutation";
import { UserFacingError } from "@/lib/mutation";
import { detectFileType, MAX_UPLOAD_BYTES } from "@/lib/file-types";

export function uploadRoot() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./storage/uploads");
}

/** Resolve a stored name to a path, refusing anything that escapes the upload root. */
export function storedPath(storedName: string) {
  const root = uploadRoot();
  const full = path.resolve(/*turbopackIgnore: true*/ root, storedName);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid stored file path");
  return full;
}

/** Returns the uploaded File from a form field, or null when nothing was chosen. */
export function getUpload(fd: FormData, field: string): File | null {
  const v = fd.get(field);
  return v instanceof File && v.size > 0 ? v : null;
}

/**
 * Validates and stores an uploaded bill/receipt, then records it in the
 * transaction. The file type is decided by its content (magic bytes), never by
 * the name or the browser-supplied type. Stored under a random name.
 * Returns the attachment id and a cleanup function to delete the file if the
 * surrounding transaction fails.
 */
export async function saveUpload(tx: Tx, file: File, userId: string) {
  if (file.size > MAX_UPLOAD_BYTES) throw new UserFacingError("File is too large (maximum 10 MB).");
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = detectFileType(bytes);
  if (!type) throw new UserFacingError("Only PDF, JPG, PNG or WEBP files can be attached.");

  const now = new Date();
  const storedName = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${type.ext}`;
  const full = storedPath(storedName);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes, { flag: "wx", mode: 0o640 });

  const originalName = (file.name || `attachment.${type.ext}`).replace(/[^\w.\- ()]/g, "_").slice(0, 150);
  const attachment = await tx.attachment.create({
    data: {
      storedName,
      originalName,
      mimeType: type.mime,
      sizeBytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      uploadedById: userId,
    },
  });
  return { id: attachment.id, cleanup: () => unlink(full).catch(() => undefined) };
}

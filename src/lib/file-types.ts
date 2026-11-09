export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type FileType = { mime: string; ext: string };

/** Identify an allowed file type from its first bytes. Returns null for anything else. */
export function detectFileType(b: Uint8Array): FileType | null {
  const starts = (sig: number[], offset = 0) => sig.every((x, i) => b[offset + i] === x);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: "application/pdf", ext: "pdf" }; // %PDF-
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  if (starts([0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return { mime: "image/webp", ext: "webp" };
  return null;
}

"use client";

import { useRef, useState } from "react";
import { FileText, Paperclip, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatFileSize } from "@/lib/format";
import type { AttachmentInfo } from "@/lib/types";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";
const MAX = 10 * 1024 * 1024;

/**
 * Receipt attachment picker. In Stage 1 only the file name and size are kept
 * (nothing is uploaded). Stage 2 stores the file on the server.
 */
export function FileDrop({ value, onChange }: { value?: AttachmentInfo; onChange: (v?: AttachmentInfo) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string>();

  const accept = (f?: File) => {
    if (!f) return;
    const ok = /\.(pdf|jpe?g|png|webp)$/i.test(f.name);
    if (!ok) return setError("Only PDF, JPG, PNG or WEBP files are allowed.");
    if (f.size > MAX) return setError("File is larger than 10 MB.");
    setError(undefined);
    onChange({ name: f.name, size: f.size });
  };

  if (value)
    return (
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <FileText className="size-5 shrink-0 text-brand-600" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{value.name}</p>
          <p className="text-xs text-slate-500">{formatFileSize(value.size)}</p>
        </div>
        <button type="button" onClick={() => onChange(undefined)} aria-label="Remove attachment" className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
          <X className="size-4" />
        </button>
      </div>
    );

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          accept(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors",
          drag ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-slate-400 hover:bg-slate-50",
        )}
      >
        <UploadCloud className="size-6 text-slate-400" />
        <span className="text-sm font-medium text-slate-700">Attach receipt or bill</span>
        <span className="text-xs text-slate-500">Drag a file here or click to browse · PDF, JPG, PNG · max 10 MB</span>
      </button>
      <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => accept(e.target.files?.[0])} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function AttachmentChip({ file }: { file?: AttachmentInfo }) {
  if (!file) return <span className="text-slate-300">—</span>;
  return (
    <span title={`${file.name} (${formatFileSize(file.size)})`} className="inline-flex max-w-40 items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
      <Paperclip className="size-3 shrink-0" />
      <span className="truncate">{file.name}</span>
    </span>
  );
}

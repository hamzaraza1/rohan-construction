"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Banknote, Building, FileCheck2, Plus, X } from "lucide-react";
import { useStore } from "@/lib/store";
import type { PaymentMethod } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Segmented, Select } from "@/components/ui/Field";

export function FormModal({
  title,
  description,
  onClose,
  onSubmit,
  submitLabel = "Save",
  size = "md",
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  submitLabel?: string;
  size?: "sm" | "md" | "lg" | "xl";
  children: ReactNode;
}) {
  const id = "form-" + title.replace(/\W+/g, "-").toLowerCase();
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={id}>{submitLabel}</Button>
        </>
      }
    >
      <form
        id={id}
        onSubmit={(e) => {
          e.stopPropagation(); // modals render in a portal; keep submit from reaching a parent form
          onSubmit(e);
        }}
        noValidate
        className="space-y-4"
      >
        {children}
      </form>
    </Modal>
  );
}

export function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={cols === 3 ? "grid gap-4 sm:grid-cols-3" : "grid gap-4 sm:grid-cols-2"}>{children}</div>;
}

/** Project dropdown. Completed projects are listed last; planning projects are allowed. */
export function ProjectSelect(props: React.ComponentProps<typeof Select> & { includeAll?: boolean }) {
  const { data } = useStore();
  const { includeAll, ...rest } = props;
  const open = data.projects.filter((p) => p.status !== "COMPLETED");
  const done = data.projects.filter((p) => p.status === "COMPLETED");
  return (
    <Select {...rest}>
      {includeAll ? <option value="">All projects</option> : <option value="">Select project…</option>}
      <optgroup label="Running projects">
        {open.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
      </optgroup>
      {done.length > 0 && (
        <optgroup label="Completed">
          {done.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
        </optgroup>
      )}
    </Select>
  );
}

export function MethodField({ value, onChange, allowCheque = true }: { value: PaymentMethod; onChange: (v: PaymentMethod) => void; allowCheque?: boolean }) {
  const opts: { value: PaymentMethod; label: string; icon: ReactNode }[] = [
    { value: "CASH", label: "Cash", icon: <Banknote className="size-4" /> },
    { value: "BANK_TRANSFER", label: "Bank transfer", icon: <Building className="size-4" /> },
  ];
  if (allowCheque) opts.push({ value: "CHEQUE", label: "Cheque", icon: <FileCheck2 className="size-4" /> });
  return <Segmented name="method" value={value} onChange={onChange} options={opts} />;
}

/** Editable list of short text items (used for included / excluded work scope). */
export function ListEditor({ value, onChange, placeholder, tone }: { value: string[]; onChange: (v: string[]) => void; placeholder: string; tone: "green" | "red" }) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim();
    if (!t || value.includes(t)) return;
    onChange([...value, t]);
    setText("");
  };
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((v) => (
            <li key={v} className={tone === "green" ? "flex items-center gap-2 rounded-md bg-emerald-50 px-2.5 py-1.5 text-sm text-emerald-900" : "flex items-center gap-2 rounded-md bg-red-50 px-2.5 py-1.5 text-sm text-red-900"}>
              <span className="flex-1">{v}</span>
              <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="rounded p-0.5 opacity-60 hover:opacity-100">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
        />
        <Button variant="secondary" onClick={add} aria-label="Add item"><Plus className="size-4" /></Button>
      </div>
    </div>
  );
}

export function InfoBox({ tone = "slate", children }: { tone?: "slate" | "amber" | "red" | "blue"; children: ReactNode }) {
  const c = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-800",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
  }[tone];
  return <div className={`rounded-lg border px-3 py-2.5 text-sm ${c}`}>{children}</div>;
}

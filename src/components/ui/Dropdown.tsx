"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonClass } from "./Button";

export interface DropdownItem {
  label: string;
  description?: string;
  icon?: ReactNode;
  onSelect: () => void;
}

export function Dropdown({ label, items, align = "right", variant = "primary" }: { label: ReactNode; items: DropdownItem[]; align?: "left" | "right"; variant?: "primary" | "secondary" }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={buttonClass(variant)}>
        {label}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="menu" className={cn("absolute top-12 z-30 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg", align === "right" ? "right-0" : "left-0")}>
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
            >
              {it.icon && <span className="mt-0.5 text-slate-400">{it.icon}</span>}
              <span>
                <span className="block text-sm font-medium text-slate-800">{it.label}</span>
                {it.description && <span className="block text-xs text-slate-500">{it.description}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

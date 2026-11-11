"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useStore } from "@/lib/store";
import { Logo } from "./Logo";
import { NAV, isActive } from "./nav";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { canEdit } = useStore();
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV.map((g, i) => {
        const items = g.items.filter((it) => canEdit || it.href !== "/settings");
        if (!items.length) return null;
        return (
          <div key={i}>
            {g.section && <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-brand-200/60 uppercase">{g.section}</p>}
            <ul className="space-y-0.5">
              {items.map((it) => {
                const active = isActive(pathname, it.href);
                const Icon = it.icon;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active ? "bg-white/10 text-white" : "text-brand-100/80 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      {active && <span className="absolute top-1.5 bottom-1.5 left-0 w-1 rounded-r bg-accent-500" />}
                      <Icon className={cn("size-[18px] shrink-0", active ? "text-accent-400" : "text-brand-200/70 group-hover:text-brand-100")} />
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function Footer() {
  const { data } = useStore();
  return (
    <div className="border-t border-white/10 px-5 py-4 text-xs text-brand-200/70">
      <p className="font-medium text-brand-100">{data.settings.companyName}</p>
      <p className="mt-0.5">Frontend preview · demo data</p>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-brand-900 lg:flex">
      <div className="flex h-16 items-center border-b border-white/10 px-5">
        <Link href="/"><Logo /></Link>
      </div>
      <NavLinks />
      <Footer />
    </aside>
  );
}

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  useEffect(() => {
    onClose();
    // close the drawer whenever the route changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={cn("fixed inset-0 z-50 lg:hidden", open ? "" : "pointer-events-none")} aria-hidden={!open}>
      <div className={cn("absolute inset-0 bg-slate-900/50 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={onClose} />
      <aside className={cn("absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-brand-900 shadow-xl transition-transform", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <Logo />
          <button type="button" onClick={onClose} aria-label="Close menu" className="rounded-md p-1 text-brand-100 hover:bg-white/10">
            <X className="size-5" />
          </button>
        </div>
        <NavLinks onNavigate={onClose} />
        <Footer />
      </aside>
    </div>
  );
}

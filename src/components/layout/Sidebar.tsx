"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Boxes, Building2, FileBarChart, HardHat, LayoutDashboard, Menu, Receipt, Settings, Truck, Users, Wallet, X,
} from "lucide-react";
import { cn } from "@/components/ui/cn";
import { NAV_ITEMS } from "./nav";

const ICONS = { Boxes, Building2, FileBarChart, HardHat, LayoutDashboard, Receipt, Settings, Truck, Users, Wallet };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

function NavLinks({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin).map((item) => {
        const Icon = ICONS[item.icon as keyof typeof ICONS];
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className={cn("size-4.5", active ? "text-accent-400" : "text-slate-400")} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-6 py-5">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="7" fill="#244b76" />
        <path d="M7 23V13l9-5 9 5v10h-5v-6h-8v6z" fill="#f5b041" />
      </svg>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-white">Rohan Construction</p>
        <p className="text-xs text-slate-400">Project &amp; Finance</p>
      </div>
    </div>
  );
}

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-brand-900 lg:flex">
      <Brand />
      <div className="flex-1 overflow-y-auto pb-6">
        <NavLinks isAdmin={isAdmin} />
      </div>
    </aside>
  );
}

export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(false), [pathname]);
  return (
    <>
      <button
        type="button"
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-brand-900">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button
                type="button"
                className="rounded-lg p-2 text-slate-300 hover:bg-white/10"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pb-6">
              <NavLinks isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

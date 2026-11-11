"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronDown, Eye, HardHat, LogOut, Menu, Search, ShieldCheck, Truck, User, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { useStore } from "@/lib/store";
import { DEMO_TODAY } from "@/lib/mock-data";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";

function GlobalSearch() {
  const { data } = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const has = (...s: (string | undefined)[]) => s.some((x) => x?.toLowerCase().includes(t));
    return [
      ...data.projects.filter((p) => has(p.name, p.code, p.siteAddress)).map((p) => ({ href: `/projects/${p.id}`, label: p.name, sub: p.code, icon: Building2 })),
      ...data.clients.filter((c) => has(c.name, c.phone)).map((c) => ({ href: `/clients/${c.id}`, label: c.name, sub: "Client", icon: Users })),
      ...data.contractors.filter((c) => has(c.name, c.phone)).map((c) => ({ href: `/contractors/${c.id}`, label: c.name, sub: "Contractor", icon: HardHat })),
      ...data.suppliers.filter((s) => has(s.name, s.contactPerson, s.phone)).map((s) => ({ href: `/suppliers/${s.id}`, label: s.name, sub: "Supplier", icon: Truck })),
    ].slice(0, 8);
  }, [q, data]);

  return (
    <div ref={box} className="relative hidden w-full max-w-md md:block">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) {
            router.push(results[0].href);
            setOpen(false);
            setQ("");
          }
        }}
        placeholder="Search projects, clients, contractors, suppliers…"
        aria-label="Search everything"
        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pr-3 pl-9 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute top-11 right-0 left-0 z-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">No matches for “{q}”.</p>
          ) : (
            <ul className="py-1">
              {results.map((r) => (
                <li key={r.href}>
                  <Link href={r.href} onClick={() => { setOpen(false); setQ(""); }} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50">
                    <r.icon className="size-4 text-slate-400" />
                    <span className="flex-1 truncate font-medium text-slate-800">{r.label}</span>
                    <span className="text-xs text-slate-500">{r.sub}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { session, setSession, data } = useStore();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const initials = session.name.split(" ").map((s) => s[0]).slice(0, 2).join("");
  const isAdmin = session.role === "ADMIN";

  const switchRole = () => {
    if (isAdmin) {
      const partner = data.users.find((u) => u.role === "PARTNER");
      setSession({ name: partner?.name ?? "Partner", email: partner?.email ?? "", role: "PARTNER" });
      toast("Now viewing as a read-only partner. Add/edit buttons are hidden.", "info");
    } else {
      setSession({ name: "Hamza Raza", email: "hamza@rohanconstruction.pk", role: "ADMIN" });
      toast("Back to admin view.", "info");
    }
    setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2 rounded-lg py-1 pr-1.5 pl-1 hover:bg-slate-100">
        <span className={cn("flex size-8 items-center justify-center rounded-full text-xs font-semibold", isAdmin ? "bg-brand-700 text-white" : "bg-amber-100 text-amber-800")}>{initials}</span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium text-slate-900">{session.name}</span>
          <span className="block text-xs text-slate-500">{isAdmin ? "Administrator" : "Partner · read only"}</span>
        </span>
        <ChevronDown className="size-4 text-slate-400" />
      </button>
      {open && (
        <div role="menu" className="absolute top-12 right-0 z-40 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-medium text-slate-900">{session.name}</p>
            <p className="truncate text-xs text-slate-500">{session.email}</p>
          </div>
          <button type="button" role="menuitem" onClick={switchRole} className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
            {isAdmin ? <Eye className="size-4 text-slate-400" /> : <ShieldCheck className="size-4 text-slate-400" />}
            <span>
              {isAdmin ? "Preview partner (read-only) view" : "Switch back to admin view"}
              <span className="block text-xs text-slate-500">Demo only</span>
            </span>
          </button>
          {isAdmin && (
            <Link href="/settings?tab=users" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <User className="size-4 text-slate-400" /> Users & access
            </Link>
          )}
          <button type="button" role="menuitem" onClick={() => router.push("/login")} className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { canEdit } = useStore();
  return (
    <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button type="button" onClick={onMenu} aria-label="Open menu" className="-ml-1 rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden">
          <Menu className="size-5" />
        </button>
        <Link href="/" className="font-semibold text-slate-900 md:hidden">Rohan Construction</Link>
        <GlobalSearch />
        <div className="ml-auto flex items-center gap-3">
          {!canEdit && <span className="hidden rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200 sm:inline">Read-only access</span>}
          <span className="hidden text-sm text-slate-500 xl:inline">{formatDate(DEMO_TODAY)}</span>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

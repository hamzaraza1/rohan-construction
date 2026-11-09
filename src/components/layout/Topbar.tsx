import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { logoutAction } from "@/app/login/actions";
import { Badge } from "@/components/ui/Badge";
import { MobileNav } from "./Sidebar";

export function Topbar({ user }: { user: SessionUser }) {
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
      <MobileNav isAdmin={user.role === "ADMIN"} />
      <div className="flex-1" />
      {user.role !== "ADMIN" && (
        <span className="hidden sm:inline">
          <Badge tone="amber">Read-only access</Badge>
        </span>
      )}
      <details className="group relative">
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-100">
          <span className="flex size-9 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">
            {initials}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-sm font-medium text-slate-900">{user.name}</span>
            <span className="block text-xs text-slate-500">{user.role === "ADMIN" ? "Administrator" : "Partner (view only)"}</span>
          </span>
        </summary>
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          <Link href="/account" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
            <KeyRound className="size-4" /> Change password
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
        </div>
      </details>
    </header>
  );
}

"use client";

import { useCallback, useState } from "react";
import { MobileNav, Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useStore } from "@/lib/store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  const close = useCallback(() => setMenu(false), []);
  const { ready } = useStore();
  return (
    <div className="min-h-dvh">
      <Sidebar />
      <MobileNav open={menu} onClose={close} />
      <div className="lg:pl-64 print:pl-0">
        <Topbar onMenu={() => setMenu(true)} />
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">{ready ? children : <div className="flex h-64 items-center justify-center text-sm text-slate-400">Loading…</div>}</main>
      </div>
    </div>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

const TABS = [
  { href: "/settings/users", label: "Users" },
  { href: "/settings/partners", label: "Partners" },
  { href: "/settings/categories/expense", label: "Expense categories" },
  { href: "/settings/categories/material", label: "Material categories" },
  { href: "/settings/categories/work", label: "Work categories" },
  { href: "/settings/categories/supplier", label: "Supplier categories" },
  { href: "/settings/audit", label: "Audit log" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <nav className="flex min-w-max gap-1 border-b border-slate-200">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap",
                active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

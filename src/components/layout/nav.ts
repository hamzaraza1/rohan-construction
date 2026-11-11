import {
  BarChart3, Boxes, Building2, HandCoins, HardHat, LayoutDashboard, Receipt, Settings, Truck, Users, Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: { section?: string; items: NavItem[] }[] = [
  { items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    section: "Sites",
    items: [
      { href: "/projects", label: "Projects", icon: Building2 },
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/payments", label: "Client Payments", icon: Wallet },
    ],
  },
  {
    section: "Work & Material",
    items: [
      { href: "/contractors", label: "Contractors", icon: HardHat },
      { href: "/suppliers", label: "Suppliers", icon: Truck },
      { href: "/inventory", label: "Inventory", icon: Boxes },
    ],
  },
  {
    section: "Finance",
    items: [
      { href: "/expenses", label: "Expenses", icon: Receipt },
      { href: "/withdrawals", label: "Partner Withdrawals", icon: HandCoins },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  { section: "Admin", items: [{ href: "/settings", label: "Settings", icon: Settings }] },
];

export const ALL_NAV = NAV.flatMap((g) => g.items);

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

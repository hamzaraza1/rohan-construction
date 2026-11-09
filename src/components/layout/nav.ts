export type NavItem = { href: string; label: string; icon: string; adminOnly?: boolean };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/projects", label: "Projects", icon: "Building2" },
  { href: "/clients", label: "Clients", icon: "Users" },
  { href: "/contractors", label: "Contractors", icon: "HardHat" },
  { href: "/suppliers", label: "Suppliers", icon: "Truck" },
  { href: "/inventory", label: "Inventory", icon: "Boxes" },
  { href: "/expenses", label: "Expenses", icon: "Receipt" },
  { href: "/partners", label: "Partner Withdrawals", icon: "Wallet" },
  { href: "/reports", label: "Reports", icon: "FileBarChart" },
  { href: "/settings", label: "Settings", icon: "Settings", adminOnly: true },
];

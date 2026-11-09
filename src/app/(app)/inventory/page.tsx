import type { Metadata } from "next";
import { PlannedModule } from "@/components/layout/PlannedModule";

export const metadata: Metadata = { title: "Inventory" };

export default function Page() {
  return <PlannedModule title="Inventory" phase={4} items={["Per-site stock from received materials", "Issue / consumption and wastage", "Stock valuation"]} />;
}

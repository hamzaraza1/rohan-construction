import type { Metadata } from "next";
import { PlannedModule } from "@/components/layout/PlannedModule";

export const metadata: Metadata = { title: "Suppliers" };

export default function Page() {
  return <PlannedModule title="Suppliers" phase={4} items={["Supplier profiles", "Purchase orders and advance payments", "Material receiving and outstanding balances"]} />;
}

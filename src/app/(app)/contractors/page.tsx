import type { Metadata } from "next";
import { PlannedModule } from "@/components/layout/PlannedModule";

export const metadata: Metadata = { title: "Contractors" };

export default function Page() {
  return <PlannedModule title="Contractors" phase={3} items={["Contractor profiles", "Contracts with included / excluded work scope", "Advances, installments, extras, deductions and balances"]} />;
}

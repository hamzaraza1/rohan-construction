import type { Metadata } from "next";
import { PlannedModule } from "@/components/layout/PlannedModule";

export const metadata: Metadata = { title: "Clients" };

export default function Page() {
  return <PlannedModule title="Clients" phase={2} items={["Client profiles and associated projects", "Manual client payment recording (cash / bank transfer)", "Payment history and receipts"]} />;
}

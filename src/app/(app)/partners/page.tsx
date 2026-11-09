import type { Metadata } from "next";
import { PlannedModule } from "@/components/layout/PlannedModule";

export const metadata: Metadata = { title: "Partner Withdrawals" };

export default function Page() {
  return <PlannedModule title="Partner Withdrawals" phase={5} items={["Record partner drawings per site", "Per-partner history", "Consolidated withdrawal report"]} />;
}

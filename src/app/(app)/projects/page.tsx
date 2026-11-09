import type { Metadata } from "next";
import { PlannedModule } from "@/components/layout/PlannedModule";

export const metadata: Metadata = { title: "Projects" };

export default function Page() {
  return <PlannedModule title="Projects" phase={2} items={["Create projects (With Material, Labour Rate, Commission)", "Per-project dashboard and cash ledger", "Configurable commission % per project"]} />;
}

import type { Metadata } from "next";
import { PlannedModule } from "@/components/layout/PlannedModule";

export const metadata: Metadata = { title: "Expenses" };

export default function Page() {
  return <PlannedModule title="Expenses" phase={5} items={["Project expenses by category", "Miscellaneous / irregular expenses section", "Bill and receipt attachments"]} />;
}

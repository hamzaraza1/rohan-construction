import type { Metadata } from "next";
import { PlannedModule } from "@/components/layout/PlannedModule";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return <PlannedModule title="Reports" phase={6} items={["Project ledger and financial reports", "Supplier / contractor outstanding reports", "PDF and Excel export with filters"]} />;
}

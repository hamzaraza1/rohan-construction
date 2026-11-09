import { requireAdminPage } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsTabs } from "./SettingsTabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="Settings" description="Administrator-only configuration. Every change is recorded in the audit log." />
      <SettingsTabs />
      <div className="mt-6">{children}</div>
    </>
  );
}

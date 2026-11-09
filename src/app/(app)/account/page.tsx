import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { PasswordForm } from "./PasswordForm";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="My account" description={`Signed in as ${user.username} (${user.role === "ADMIN" ? "Administrator" : "Read-only partner"})`} />
      <Card className="max-w-lg p-6">
        <h2 className="mb-4 font-semibold">Change password</h2>
        <PasswordForm />
      </Card>
    </>
  );
}

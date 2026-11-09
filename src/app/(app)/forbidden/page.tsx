import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

export default function ForbiddenPage() {
  return (
    <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
      <ShieldAlert className="mx-auto size-10 text-amber-600" />
      <h1 className="mt-4 text-lg font-semibold">Admin access required</h1>
      <p className="mt-2 text-sm text-slate-600">Your account has read-only access. Only the administrator can open this page.</p>
      <ButtonLink href="/" className="mt-6" variant="secondary">Back to dashboard</ButtonLink>
    </Card>
  );
}

import { Lock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export function ReadOnlyNotice() {
  return (
    <Card>
      <EmptyState icon={<Lock className="size-5" />} title="Read-only access" description="Partners can view everything but cannot add or change records. Ask the administrator to make changes." />
    </Card>
  );
}

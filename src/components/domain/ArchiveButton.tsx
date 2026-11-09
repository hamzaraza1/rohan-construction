import type { ActionResult } from "@/lib/mutation";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmSubmit } from "@/components/ui/ConfirmDialog";

export function ArchiveButton({
  action,
  archived,
  what,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  archived: boolean;
  what: string;
}) {
  return (
    <ActionForm action={action} showSuccess={false}>
      <ConfirmSubmit
        size="md"
        variant={archived ? "secondary" : "ghost"}
        label={archived ? "Restore" : "Archive"}
        title={archived ? `Restore this ${what}?` : `Archive this ${what}?`}
        message={
          archived
            ? `The ${what} will appear in lists and selections again.`
            : `The ${what} will be hidden from lists and selections. Nothing is deleted — all records and balances stay intact and it can be restored at any time.`
        }
        confirmLabel={archived ? "Restore" : "Archive"}
      />
    </ActionForm>
  );
}

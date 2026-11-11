"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { IconButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

/** Edit / delete icons for a table row. Hidden for read-only partners. */
export function RowActions({ onEdit, onDelete, deleteTitle = "Delete this record?", deleteMessage, disabledReason }: {
  onEdit?: () => void;
  onDelete?: () => void;
  deleteTitle?: string;
  deleteMessage?: React.ReactNode;
  /** If set, delete is blocked and this explains why. */
  disabledReason?: string;
}) {
  const { canEdit } = useStore();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  if (!canEdit) return null;
  return (
    <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      {onEdit && (
        <IconButton label="Edit" onClick={onEdit}>
          <Pencil className="size-4" />
        </IconButton>
      )}
      {onDelete && (
        <IconButton
          label="Delete"
          className="hover:bg-red-50 hover:text-red-600"
          onClick={() => (disabledReason ? toast(disabledReason, "info") : setConfirm(true))}
        >
          <Trash2 className="size-4" />
        </IconButton>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          onDelete?.();
          toast("Deleted");
        }}
        title={deleteTitle}
        message={deleteMessage ?? "This record will be removed and all balances recalculated."}
      />
    </div>
  );
}

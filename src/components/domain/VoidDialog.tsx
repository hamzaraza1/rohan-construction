"use client";
import { useRef } from "react";
import type { ActionResult } from "@/lib/mutation";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

/**
 * Voiding is the only way to "delete" a financial record: it stays in the
 * audit trail with the reason, and stops counting in every balance.
 */
export function VoidDialog({
  action,
  title,
  description,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  title: string;
  description: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:bg-red-50" onClick={() => ref.current?.showModal()}>
        Void
      </Button>
      <dialog ref={ref} className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl p-0 text-left shadow-xl backdrop:bg-slate-900/40">
        <ActionForm action={action} className="space-y-4 p-5" onSuccess={() => ref.current?.close()}>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </div>
          <FormField label="Reason" name="reason" required>
            <Textarea id="reason" name="reason" required maxLength={500} placeholder="e.g. Entered twice / wrong amount" />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => ref.current?.close()}>Cancel</Button>
            <SubmitButton variant="danger" pendingText="Voiding…">Void record</SubmitButton>
          </div>
        </ActionForm>
      </dialog>
    </>
  );
}

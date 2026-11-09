"use client";
import { useFormStatus } from "react-dom";
import { Button } from "./Button";
import { useActionFormState } from "./ActionForm";

export function SubmitButton({
  children,
  pendingText = "Saving…",
  ...props
}: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending: nativePending } = useFormStatus();
  const { pending: actionPending } = useActionFormState();
  const pending = nativePending || actionPending;
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}

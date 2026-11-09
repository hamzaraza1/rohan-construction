"use client";
import { useActionState, useEffect, useRef } from "react";
import type { ActionResult } from "@/lib/mutation";
import { FormMessage } from "./FormMessage";

type Action = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

/** A <form> bound to a server action that shows the action's success/error message. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  showSuccess = true,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  showSuccess?: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {state && (state.ok ? showSuccess : true) && (
        <div className="basis-full"><FormMessage state={state} /></div>
      )}
      {children}
    </form>
  );
}

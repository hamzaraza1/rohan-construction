"use client";
import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import type { ActionResult } from "@/lib/mutation";
import { FormMessage } from "./FormMessage";

type Action = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

type FormCtx = { pending: boolean; fieldErrors?: Record<string, string[] | undefined> };
const FormContext = createContext<FormCtx>({ pending: false });
export const useActionFormState = () => useContext(FormContext);

/**
 * A <form> bound to a server action.
 *  - Shows the action's success / error message and per-field errors (via <FormField>).
 *  - Keeps what the user typed when validation fails (submits via onSubmit, so
 *    React does not reset the form).
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  showSuccess = true,
  onSuccess,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  showSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <FormContext.Provider value={{ pending, fieldErrors }}>
      <form ref={ref} onSubmit={onSubmit} className={className} noValidate={false}>
        {state && (state.ok ? showSuccess : true) && (
          <div className="basis-full sm:col-span-full"><FormMessage state={state} /></div>
        )}
        {children}
      </form>
    </FormContext.Provider>
  );
}

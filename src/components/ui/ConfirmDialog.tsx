"use client";
import { useRef } from "react";
import { Button } from "./Button";

/**
 * Wraps a destructive/important form submit in a native <dialog> confirmation.
 * The trigger opens the dialog; "Confirm" submits the surrounding form.
 */
export function ConfirmSubmit({
  label,
  title,
  message,
  confirmLabel = "Confirm",
  variant = "danger",
  size = "sm",
}: {
  label: React.ReactNode;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => ref.current?.showModal()}>
        {label}
      </Button>
      <dialog
        ref={ref}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl p-0 shadow-xl backdrop:bg-slate-900/40"
      >
        <div className="p-5">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => ref.current?.close()}>
              Cancel
            </Button>
            <Button type="submit" variant={variant === "danger" ? "danger" : "primary"} onClick={() => ref.current?.close()}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

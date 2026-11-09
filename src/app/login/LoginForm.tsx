"use client";
import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormMessage } from "@/components/ui/FormMessage";

export function LoginForm() {
  const [state, action] = useActionState<LoginState, FormData>(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Username" htmlFor="username">
        <Input id="username" name="username" defaultValue={state?.username ?? ""} key={state?.username ?? ""} autoComplete="username" autoCapitalize="none" required autoFocus={!state?.username} />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required autoFocus={Boolean(state?.username)} />
      </Field>
      <SubmitButton className="w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

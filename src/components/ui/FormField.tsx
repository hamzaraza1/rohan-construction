"use client";
import { useActionFormState } from "./ActionForm";
import { Field } from "./Field";

/** <Field> that shows the server-side validation error for `name`. */
export function FormField(props: Omit<React.ComponentProps<typeof Field>, "error" | "htmlFor"> & { name: string; htmlFor?: string }) {
  const { fieldErrors } = useActionFormState();
  const { name, htmlFor, ...rest } = props;
  return <Field {...rest} htmlFor={htmlFor ?? name} error={fieldErrors?.[name]} />;
}

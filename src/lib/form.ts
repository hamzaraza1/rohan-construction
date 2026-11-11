"use client";

import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";
import { DEMO_TODAY } from "./mock-data";

export type Errors<T> = Partial<Record<keyof T, string>>;

/** Minimal form state + validation hook used by all Stage 1 forms. */
export function useForm<T extends Record<string, unknown>>(initial: T, validate: (v: T) => Errors<T>) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Errors<T>>({});
  const [submitted, setSubmitted] = useState(false);

  const set = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      setValues((prev) => {
        const next = { ...prev, [key]: value };
        if (submitted) setErrors(validate(next));
        return next;
      });
    },
    [submitted, validate],
  );

  /** Props for a text/select input bound to `key`. */
  const bind = <K extends keyof T>(key: K) => ({
    id: String(key),
    name: String(key),
    value: (values[key] ?? "") as string,
    invalid: Boolean(errors[key]),
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(key, e.target.value as T[K]),
  });

  const handleSubmit = (onValid: (v: T) => void) => (e?: FormEvent) => {
    e?.preventDefault();
    setSubmitted(true);
    const errs = validate(values);
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    onValid(values);
  };

  const reset = (v: T = initial) => {
    setValues(v);
    setErrors({});
    setSubmitted(false);
  };

  return { values, errors, set, bind, handleSubmit, reset, setValues };
}

// ------------------------------------------------------------ validators
export const parseAmount = (s: string) => Number(String(s).replace(/,/g, "").trim());

export function checkAmount(s: string, { allowZero = false, max }: { allowZero?: boolean; max?: number } = {}) {
  const t = String(s ?? "").replace(/,/g, "").trim();
  if (!t) return "Amount is required";
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return "Enter a valid amount (up to 2 decimals)";
  const n = Number(t);
  if (!allowZero && n <= 0) return "Amount must be greater than zero";
  if (n > 9_999_999_999) return "Amount is too large";
  if (max !== undefined && n > max) return `Cannot be more than ${max.toLocaleString("en-US")}`;
  return undefined;
}

export function checkQuantity(s: string, max?: number, unit = "") {
  const t = String(s ?? "").replace(/,/g, "").trim();
  if (!t) return "Quantity is required";
  if (!/^\d+(\.\d{1,3})?$/.test(t)) return "Enter a valid quantity";
  const n = Number(t);
  if (n <= 0) return "Quantity must be greater than zero";
  if (max !== undefined && n > max) return `Only ${max.toLocaleString("en-US")} ${unit} in stock`;
  return undefined;
}

export const required = (s: unknown, label = "This field") => (String(s ?? "").trim() ? undefined : `${label} is required`);

export function checkDate(s: string, { notFuture = true, min }: { notFuture?: boolean; min?: string } = {}) {
  if (!s) return "Date is required";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "Enter a valid date";
  if (notFuture && s > DEMO_TODAY) return "Date cannot be in the future";
  if (min && s < min) return "Date is before the start date";
  return undefined;
}

export function checkPhone(s: string) {
  if (!s.trim()) return "Phone number is required";
  if (!/^(\+92|0)[\d\- ]{9,13}$/.test(s.trim())) return "Use a Pakistani number, e.g. 0300-1234567";
  return undefined;
}

export const checkEmail = (s: string, req = false) =>
  !s.trim() ? (req ? "Email is required" : undefined) : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim()) ? undefined : "Enter a valid email address";

export const checkCnic = (s: string) => (!s.trim() || /^\d{5}-\d{7}-\d$/.test(s.trim()) ? undefined : "Format: 35202-1234567-1");

export function clean<T extends Record<string, unknown>>(errs: T) {
  return Object.fromEntries(Object.entries(errs).filter(([, v]) => v)) as T;
}

export const today = () => DEMO_TODAY;

import { z } from "zod";

/** Optional text: trims, turns "" into null. */
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters`)
    .optional()
    .transform((v) => (v ? v : null));

export const requiredText = (max = 200) => z.string().trim().min(1, "Required").max(max, `At most ${max} characters`);

const MONEY_RE = /^\d{1,12}(\.\d{1,2})?$/;

/**
 * Money typed by a person: "2,500,000", "1500.50", "Rs. 300000".
 * Returns a plain decimal string (exact; no floating point) for Prisma Decimal columns.
 */
export const money = (opts: { allowZero?: boolean } = {}) =>
  z
    .string({ error: "Required" })
    .transform((v) => v.replace(/rs\.?/i, "").replace(/[,\s]/g, ""))
    .refine((v) => v !== "", "Required")
    .refine((v) => MONEY_RE.test(v), "Enter an amount like 250000 or 1500.50")
    .refine((v) => (opts.allowZero ? Number(v) >= 0 : Number(v) > 0), opts.allowZero ? "Cannot be negative" : "Must be greater than zero");

export const optionalMoney = () =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? "").replace(/rs\.?/i, "").replace(/[,\s]/g, ""))
    .refine((v) => v === "" || MONEY_RE.test(v), "Enter an amount like 250000 or 1500.50")
    .transform((v) => (v === "" ? null : v));

export const percent = () =>
  z
    .string()
    .transform((v) => v.replace(/[%\s]/g, ""))
    .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v), "Enter a percentage like 10 or 12.5")
    .refine((v) => Number(v) > 0 && Number(v) <= 100, "Must be more than 0 and at most 100");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(v: string): Date | null {
  if (!DATE_RE.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : d;
}

/** Today's date in Pakistan (UTC+5) as YYYY-MM-DD. */
export function todayPk(): string {
  return new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
}

/** A calendar date from <input type="date"> (YYYY-MM-DD), stored as UTC midnight. */
export const dateInput = (opts: { notInFuture?: boolean } = {}) =>
  z
    .string({ error: "Required" })
    .refine((v) => v !== "", "Required")
    .refine((v) => parseDate(v) !== null, "Invalid date")
    .refine((v) => !opts.notInFuture || v <= todayPk(), "Date cannot be in the future")
    .transform((v) => parseDate(v)!);

export const optionalDateInput = () =>
  z
    .string()
    .optional()
    .refine((v) => !v || parseDate(v) !== null, "Invalid date")
    .transform((v) => (v ? parseDate(v)! : null));

export const paymentMethod = z.enum(["CASH", "BANK_TRANSFER"], { error: "Choose a payment method" });

export const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");

/** Date → "YYYY-MM-DD" for <input type="date"> default values. */
export const toDateInput = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

/** FormData → plain object of strings (files are dropped; read them separately). */
export function formFields(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

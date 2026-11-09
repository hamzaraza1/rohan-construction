// Formatting helpers shared by server and client components.
// Currency: Pakistani Rupee, shown as "Rs. 1,234,567". Dates: "09 Nov 2026".

type Numeric = number | string | { toString(): string } | null | undefined;

const toNumber = (v: Numeric) => (v == null ? 0 : typeof v === "number" ? v : Number(v.toString()));

const moneyFmt = new Intl.NumberFormat("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatMoney(value: Numeric): string {
  const n = toNumber(value);
  const abs = moneyFmt.format(Math.abs(n));
  return n < 0 ? `-Rs. ${abs}` : `Rs. ${abs}`;
}

export function formatNumber(value: Numeric, maxFractionDigits = 3): string {
  return new Intl.NumberFormat("en-PK", { maximumFractionDigits: maxFractionDigits }).format(toNumber(value));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Formats a date as "DD Mon YYYY". Dates stored as PostgreSQL DATE arrive as
 * UTC midnight, so UTC parts are used to avoid off-by-one-day shifts.
 */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Date + time in Pakistan time, for timestamps such as audit entries. */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  const pk = new Date(d.getTime() + 5 * 60 * 60 * 1000); // Asia/Karachi is UTC+5, no DST
  const hh = String(pk.getUTCHours()).padStart(2, "0");
  const mm = String(pk.getUTCMinutes()).padStart(2, "0");
  return `${formatDate(pk)}, ${hh}:${mm}`;
}

export const PROJECT_TYPE_LABELS = {
  WITH_MATERIAL: "With Material",
  LABOUR_RATE: "Labour Rate",
  COMMISSION: "Commission Based",
} as const;

export const PROJECT_STATUS_LABELS = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const;

export const PAYMENT_METHOD_LABELS = { CASH: "Cash", BANK_TRANSFER: "Bank Transfer" } as const;

export const LEDGER_SOURCE_LABELS: Record<string, string> = {
  CLIENT_PAYMENT: "Client payment",
  SUPPLIER_PAYMENT: "Supplier payment",
  CONTRACTOR_PAYMENT: "Contractor payment",
  EXPENSE: "Expense",
  PARTNER_WITHDRAWAL: "Partner withdrawal",
};

import type { ContractStatus, ContractorPaymentType, PaymentMethod, ProjectStatus, StockMovementType, SupplierPaymentType } from "./types";

const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const qty = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });

export function formatMoney(n: number) {
  const v = Math.round(n * 100) / 100;
  return `${v < 0 ? "−" : ""}Rs. ${money.format(Math.abs(v))}`;
}

/** Short form for cards and charts: Rs. 4.25 Cr, Rs. 12.5 Lac. */
export function formatMoneyShort(n: number) {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a >= 10_000_000) return `${sign}Rs. ${(a / 10_000_000).toFixed(2).replace(/\.?0+$/, "")} Cr`;
  if (a >= 100_000) return `${sign}Rs. ${(a / 100_000).toFixed(2).replace(/\.?0+$/, "")} Lac`;
  return formatMoney(n);
}

export function formatQty(n: number, unit?: string) {
  return unit ? `${qty.format(n)} ${unit}` : qty.format(n);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "09 Nov 2026" */
export function formatDate(iso?: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

export function formatDateTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" });
}

export function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  CHEQUE: "Cheque",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  ACTIVE: "In progress",
  COMPLETED: "Completed",
  TERMINATED: "Terminated",
};

export const CONTRACTOR_PAYMENT_TYPE_LABELS: Record<ContractorPaymentType, string> = {
  ADVANCE: "Advance",
  INSTALLMENT: "Installment",
  FINAL: "Final payment",
};

export const SUPPLIER_PAYMENT_TYPE_LABELS: Record<SupplierPaymentType, string> = {
  ADVANCE: "Advance",
  PAYMENT: "Payment",
};

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType | "RECEIVED", string> = {
  RECEIVED: "Received",
  CONSUMPTION: "Consumed",
  WASTAGE: "Wastage",
};

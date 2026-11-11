// All financial figures are derived here from the raw records, so every screen
// uses the same formulas. Stage 2 moves these into SQL views.
//
//   Available cash   = client payments − supplier payments − contractor payments
//                      − site expenses − partner withdrawals
//   Total expenses   = supplier payments + contractor payments + site expenses
//                      (partner withdrawals reduce cash but are NOT expenses)
//   Material cost    = value of material actually received (not orders, not advances)
//   Supplier balance = received value − paid  (negative = advance with supplier)
//   Contract balance = contract amount + extras − deductions − paid

import type { Contract, DataState, Delivery, ISODate, Project } from "./types";

export const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((t, r) => t + f(r), 0);
export const deliveryValue = (d: Delivery) => sum(d.lines, (l) => l.quantity * l.rate);

export interface ProjectFinancials {
  contractValue: number;
  received: number;
  clientBalance: number;
  supplierPaid: number;
  contractorPaid: number;
  siteExpenses: number;
  totalExpenses: number;
  withdrawals: number;
  cash: number;
  materialReceived: number;
  supplierOutstanding: number;
  supplierAdvance: number;
  contractCommitted: number;
  contractorOutstanding: number;
}

export function projectFinancials(s: DataState, projectId?: string): ProjectFinancials {
  const by = <T extends { projectId: string }>(rows: T[]) => (projectId ? rows.filter((r) => r.projectId === projectId) : rows);
  const projects = projectId ? s.projects.filter((p) => p.id === projectId) : s.projects;
  const received = sum(by(s.clientPayments), (r) => r.amount);
  const supplierPaid = sum(by(s.supplierPayments), (r) => r.amount);
  const contracts = projectId ? s.contracts.filter((c) => c.projectId === projectId) : s.contracts;
  const balances = contracts.map((c) => contractBalance(s, c));
  const contractorPaid = sum(balances, (b) => b.paid);
  const siteExpenses = sum(by(s.expenses), (r) => r.amount);
  const withdrawals = sum(by(s.withdrawals), (r) => r.amount);
  const accounts = supplierAccounts(s, projectId);
  const contractValue = sum(projects, (p) => p.contractValue);
  return {
    contractValue,
    received,
    clientBalance: contractValue - received,
    supplierPaid,
    contractorPaid,
    siteExpenses,
    totalExpenses: supplierPaid + contractorPaid + siteExpenses,
    withdrawals,
    cash: received - supplierPaid - contractorPaid - siteExpenses - withdrawals,
    materialReceived: sum(by(s.deliveries), deliveryValue),
    supplierOutstanding: sum(accounts, (a) => Math.max(a.balance, 0)),
    supplierAdvance: sum(accounts, (a) => Math.max(-a.balance, 0)),
    contractCommitted: sum(balances, (b) => b.netPayable),
    contractorOutstanding: sum(balances, (b) => b.outstanding),
  };
}

export interface ContractBalance {
  extras: number;
  deductions: number;
  netPayable: number;
  paid: number;
  outstanding: number;
  overpaid: number;
}

export function contractBalance(s: DataState, c: Contract): ContractBalance {
  const adj = s.contractAdjustments.filter((a) => a.contractId === c.id);
  const extras = sum(adj.filter((a) => a.type === "EXTRA"), (a) => a.amount);
  const deductions = sum(adj.filter((a) => a.type === "DEDUCTION"), (a) => a.amount);
  const netPayable = c.amount + extras - deductions;
  const paid = sum(s.contractorPayments.filter((p) => p.contractId === c.id), (p) => p.amount);
  return { extras, deductions, netPayable, paid, outstanding: Math.max(netPayable - paid, 0), overpaid: Math.max(paid - netPayable, 0) };
}

export function contractorTotals(s: DataState, contractorId: string) {
  const contracts = s.contracts.filter((c) => c.contractorId === contractorId);
  const b = contracts.map((c) => contractBalance(s, c));
  return {
    contracts: contracts.length,
    active: contracts.filter((c) => c.status === "ACTIVE").length,
    committed: sum(b, (x) => x.netPayable),
    paid: sum(b, (x) => x.paid),
    outstanding: sum(b, (x) => x.outstanding),
  };
}

export interface SupplierAccount {
  projectId: string;
  supplierId: string;
  delivered: number;
  paid: number;
  advancesPaid: number;
  /** positive = we owe the supplier; negative = advance sitting with the supplier */
  balance: number;
}

export function supplierAccounts(s: DataState, projectId?: string, supplierId?: string): SupplierAccount[] {
  const map = new Map<string, SupplierAccount>();
  const get = (p: string, sp: string) => {
    const k = `${p}|${sp}`;
    let a = map.get(k);
    if (!a) map.set(k, (a = { projectId: p, supplierId: sp, delivered: 0, paid: 0, advancesPaid: 0, balance: 0 }));
    return a;
  };
  for (const d of s.deliveries) {
    if ((projectId && d.projectId !== projectId) || (supplierId && d.supplierId !== supplierId)) continue;
    get(d.projectId, d.supplierId).delivered += deliveryValue(d);
  }
  for (const p of s.supplierPayments) {
    if ((projectId && p.projectId !== projectId) || (supplierId && p.supplierId !== supplierId)) continue;
    const a = get(p.projectId, p.supplierId);
    a.paid += p.amount;
    if (p.type === "ADVANCE") a.advancesPaid += p.amount;
  }
  for (const a of map.values()) a.balance = Math.round((a.delivered - a.paid) * 100) / 100;
  return [...map.values()];
}

export function supplierTotals(s: DataState, supplierId: string) {
  const acc = supplierAccounts(s, undefined, supplierId);
  return {
    delivered: sum(acc, (a) => a.delivered),
    paid: sum(acc, (a) => a.paid),
    outstanding: sum(acc, (a) => Math.max(a.balance, 0)),
    advance: sum(acc, (a) => Math.max(-a.balance, 0)),
    projects: acc.length,
  };
}

export interface StockRow {
  projectId: string;
  materialId: string;
  received: number;
  receivedValue: number;
  consumed: number;
  wasted: number;
  onHand: number;
  avgRate: number;
  stockValue: number;
}

export function projectStock(s: DataState, projectId?: string): StockRow[] {
  const map = new Map<string, StockRow>();
  const get = (p: string, m: string) => {
    const k = `${p}|${m}`;
    let r = map.get(k);
    if (!r) map.set(k, (r = { projectId: p, materialId: m, received: 0, receivedValue: 0, consumed: 0, wasted: 0, onHand: 0, avgRate: 0, stockValue: 0 }));
    return r;
  };
  for (const d of s.deliveries) {
    if (projectId && d.projectId !== projectId) continue;
    for (const l of d.lines) {
      const r = get(d.projectId, l.materialId);
      r.received += l.quantity;
      r.receivedValue += l.quantity * l.rate;
    }
  }
  for (const m of s.stockMovements) {
    if (projectId && m.projectId !== projectId) continue;
    const r = get(m.projectId, m.materialId);
    if (m.type === "CONSUMPTION") r.consumed += m.quantity;
    else r.wasted += m.quantity;
  }
  for (const r of map.values()) {
    r.onHand = Math.round((r.received - r.consumed - r.wasted) * 1000) / 1000;
    r.avgRate = r.received > 0 ? r.receivedValue / r.received : 0;
    r.stockValue = r.onHand * r.avgRate;
  }
  return [...map.values()];
}

export function stockOnHand(s: DataState, projectId: string, materialId: string) {
  return projectStock(s, projectId).find((r) => r.materialId === materialId)?.onHand ?? 0;
}

export type LedgerKind = "CLIENT_PAYMENT" | "SUPPLIER_PAYMENT" | "CONTRACTOR_PAYMENT" | "EXPENSE" | "WITHDRAWAL";

export const LEDGER_LABELS: Record<LedgerKind, string> = {
  CLIENT_PAYMENT: "Client payment",
  SUPPLIER_PAYMENT: "Supplier payment",
  CONTRACTOR_PAYMENT: "Contractor payment",
  EXPENSE: "Site expense",
  WITHDRAWAL: "Partner withdrawal",
};

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  date: ISODate;
  projectId: string;
  party: string;
  description: string;
  method: string;
  inflow: number;
  outflow: number;
  href?: string;
}

/** Every cash movement, newest first. */
export function cashLedger(s: DataState, projectId?: string): LedgerEntry[] {
  const name = <T extends { id: string; name: string }>(rows: T[], id: string) => rows.find((r) => r.id === id)?.name ?? "—";
  const out: LedgerEntry[] = [];
  const keep = (p: string) => !projectId || p === projectId;
  for (const r of s.clientPayments) if (keep(r.projectId)) {
    const project = s.projects.find((p) => p.id === r.projectId);
    out.push({ id: r.id, kind: "CLIENT_PAYMENT", date: r.date, projectId: r.projectId, party: project ? name(s.clients, project.clientId) : "—", description: r.note ?? "Client payment", method: r.method, inflow: r.amount, outflow: 0, href: "/payments" });
  }
  for (const r of s.supplierPayments) if (keep(r.projectId)) {
    out.push({ id: r.id, kind: "SUPPLIER_PAYMENT", date: r.date, projectId: r.projectId, party: name(s.suppliers, r.supplierId), description: r.type === "ADVANCE" ? `Advance${r.note ? ` — ${r.note}` : ""}` : (r.note ?? "Payment against deliveries"), method: r.method, inflow: 0, outflow: r.amount, href: `/suppliers/${r.supplierId}` });
  }
  for (const r of s.contractorPayments) {
    const c = s.contracts.find((x) => x.id === r.contractId);
    if (!c || !keep(c.projectId)) continue;
    out.push({ id: r.id, kind: "CONTRACTOR_PAYMENT", date: r.date, projectId: c.projectId, party: name(s.contractors, c.contractorId), description: `${r.type === "ADVANCE" ? "Advance" : r.type === "FINAL" ? "Final payment" : "Installment"} — ${name(s.workCategories, c.workCategoryId)}`, method: r.method, inflow: 0, outflow: r.amount, href: `/contractors/contracts/${c.id}` });
  }
  for (const r of s.expenses) if (keep(r.projectId)) {
    out.push({ id: r.id, kind: "EXPENSE", date: r.date, projectId: r.projectId, party: r.paidTo, description: `${name(s.expenseCategories, r.categoryId)} — ${r.description}`, method: r.method, inflow: 0, outflow: r.amount, href: "/expenses" });
  }
  for (const r of s.withdrawals) if (keep(r.projectId)) {
    out.push({ id: r.id, kind: "WITHDRAWAL", date: r.date, projectId: r.projectId, party: name(s.partners, r.partnerId), description: r.note ?? "Partner withdrawal", method: r.method, inflow: 0, outflow: r.amount, href: "/withdrawals" });
  }
  return out.sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));
}

/** Monthly inflow/outflow for the last `months` months ending at `end` (YYYY-MM). */
export function monthlyCashFlow(s: DataState, end: string, months = 12, projectId?: string) {
  const keys: string[] = [];
  const [y, m] = end.split("-").map(Number);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    keys.push(d.toISOString().slice(0, 7));
  }
  const rows = keys.map((k) => ({ month: k, inflow: 0, outflow: 0 }));
  const idx = new Map(keys.map((k, i) => [k, i]));
  for (const e of cashLedger(s, projectId)) {
    if (e.kind === "WITHDRAWAL") continue;
    const i = idx.get(e.date.slice(0, 7));
    if (i === undefined) continue;
    rows[i].inflow += e.inflow;
    rows[i].outflow += e.outflow;
  }
  return rows;
}

export function projectLabel(p?: Project) {
  return p ? `${p.code} · ${p.name}` : "—";
}

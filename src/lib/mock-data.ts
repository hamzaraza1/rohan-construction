// Stage 1 mock data. Realistic, internally consistent figures so every screen
// can be reviewed. Generated deterministically (fixed seed), so it is the same
// on every load. Stage 2 replaces this with the PostgreSQL database.

import type {
  Category, Client, ClientPayment, Contract, ContractAdjustment, Contractor, ContractorPayment, DataState, Delivery,
  Expense, Material, PaymentMethod, Project, StockMovement, Supplier, SupplierPayment, Withdrawal,
} from "./types";

export const DEMO_TODAY = "2026-11-10";

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261110);
const between = (min: number, max: number) => min + rand() * (max - min);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

function addMonths(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n, 1);
  return d.toISOString().slice(0, 10);
}
function dayInMonth(monthStart: string, minDay = 1, maxDay = 28) {
  // In the current month, keep dates on or before "today" (spread out, not piled on today).
  if (monthStart.slice(0, 7) === DEMO_TODAY.slice(0, 7)) {
    const last = Number(DEMO_TODAY.slice(8, 10));
    maxDay = Math.min(maxDay, last);
    minDay = Math.min(minDay, maxDay);
  }
  const day = Math.floor(between(minDay, maxDay + 1));
  return monthStart.slice(0, 8) + String(day).padStart(2, "0");
}

let seq = 0;
const nextId = (prefix: string) => `${prefix}${(++seq).toString(36)}`;

// ---------------------------------------------------------------- categories
export const expenseCategories: Category[] = [
  { id: "ec1", name: "Labour Wages (Daily)", isActive: true },
  { id: "ec2", name: "Transport & Freight", isActive: true },
  { id: "ec3", name: "Machinery Rent", isActive: true },
  { id: "ec4", name: "Utility Bills", isActive: true },
  { id: "ec5", name: "Site Office & Stationery", isActive: true },
  { id: "ec6", name: "Govt. Fees & Approvals", isActive: true },
  { id: "ec7", name: "Security Guard", isActive: true },
  { id: "ec8", name: "Water Tanker", isActive: true },
  { id: "ec9", name: "Small Tools & Hardware", isActive: true },
  { id: "ec10", name: "Miscellaneous / Irregular", isActive: true, isMiscellaneous: true },
  { id: "ec11", name: "Food & Refreshments", isActive: true, isMiscellaneous: true },
  { id: "ec12", name: "Tips & Donations", isActive: true, isMiscellaneous: true },
];

export const materialCategories: Category[] = [
  { id: "mc1", name: "Cement & Binders", isActive: true },
  { id: "mc2", name: "Steel", isActive: true },
  { id: "mc3", name: "Bricks & Blocks", isActive: true },
  { id: "mc4", name: "Sand & Aggregates", isActive: true },
  { id: "mc5", name: "Electrical", isActive: true },
  { id: "mc6", name: "Plumbing & Sanitary", isActive: true },
  { id: "mc7", name: "Tiles & Finishing", isActive: true },
  { id: "mc8", name: "Wood & Shuttering", isActive: true },
];

export const workCategories: Category[] = [
  { id: "wc1", name: "Grey Structure (Masonry)", isActive: true },
  { id: "wc2", name: "Steel Fixing", isActive: true },
  { id: "wc3", name: "Shuttering", isActive: true },
  { id: "wc4", name: "Electrical", isActive: true },
  { id: "wc5", name: "Plumbing", isActive: true },
  { id: "wc6", name: "Tile & Marble", isActive: true },
  { id: "wc7", name: "Paint & Polish", isActive: true },
  { id: "wc8", name: "Woodwork", isActive: true },
  { id: "wc9", name: "Excavation", isActive: true },
];

// ------------------------------------------------------------------ materials
export const materials: Material[] = [
  { id: "m1", name: "Cement (OPC)", categoryId: "mc1", unit: "bag" },
  { id: "m2", name: "Steel Bar Grade 60", categoryId: "mc2", unit: "kg" },
  { id: "m3", name: "Bricks (A-Class)", categoryId: "mc3", unit: "pcs" },
  { id: "m4", name: "Chenab Sand", categoryId: "mc4", unit: "cft" },
  { id: "m5", name: "Margalla Crush", categoryId: "mc4", unit: "cft" },
  { id: "m6", name: "Electric Wire 7/29", categoryId: "mc5", unit: "coil" },
  { id: "m7", name: "PVC Conduit 3/4\"", categoryId: "mc5", unit: "pcs" },
  { id: "m8", name: "PPR Pipe 1\"", categoryId: "mc6", unit: "ft" },
  { id: "m9", name: "Floor Tiles 24×24", categoryId: "mc7", unit: "sq ft" },
  { id: "m10", name: "Weather Shield Paint", categoryId: "mc7", unit: "gallon" },
  { id: "m11", name: "Sanitary Fittings Set", categoryId: "mc6", unit: "set" },
  { id: "m12", name: "Shuttering Plywood", categoryId: "mc8", unit: "sheet" },
];

const RATE: Record<string, [number, number]> = {
  m1: [1390, 1480], m2: [255, 272], m3: [16, 18.5], m4: [90, 105], m5: [145, 165], m6: [13800, 15200],
  m7: [300, 340], m8: [195, 225], m9: [270, 310], m10: [6500, 7100], m11: [42000, 52000], m12: [4000, 4400],
};

// ------------------------------------------------------------------ suppliers
export const suppliers: Supplier[] = [
  { id: "s1", name: "Al-Madina Cement Traders", contactPerson: "Haji Aslam", phone: "0300-4412876", address: "Badami Bagh, Lahore", materialCategoryIds: ["mc1"], isActive: true },
  { id: "s2", name: "Punjab Steel Agency", contactPerson: "Waqas Butt", phone: "0321-8456120", address: "Shahdara Steel Market, Lahore", materialCategoryIds: ["mc2"], isActive: true },
  { id: "s3", name: "Chaudhry Bricks Kiln", contactPerson: "Ch. Nadeem", phone: "0333-4120987", address: "Raiwind Road, Lahore", materialCategoryIds: ["mc3"], isActive: true },
  { id: "s4", name: "Raavi Sand & Crush Co.", contactPerson: "Imtiaz Ali", phone: "0345-7712340", address: "Thokar Niaz Baig, Lahore", materialCategoryIds: ["mc4"], isActive: true },
  { id: "s5", name: "Shahzad Electric Store", contactPerson: "Shahzad Anwar", phone: "0301-4567021", address: "Hall Road, Lahore", materialCategoryIds: ["mc5"], isActive: true },
  { id: "s6", name: "Hafiz Sanitary & Pipes", contactPerson: "Hafiz Usman", phone: "0322-4098712", address: "Brandreth Road, Lahore", materialCategoryIds: ["mc6"], isActive: true },
  { id: "s7", name: "Noor Tiles Gallery", contactPerson: "Noor Ahmed", phone: "0300-8423190", address: "Ferozepur Road, Lahore", materialCategoryIds: ["mc7"], isActive: true },
  { id: "s8", name: "Kashmir Timber & Plywood", contactPerson: "Abdul Rauf", phone: "0312-4456781", address: "Ravi Road, Lahore", materialCategoryIds: ["mc8"], isActive: true },
];
const SUPPLIER_FOR: Record<string, string> = {
  m1: "s1", m2: "s2", m3: "s3", m4: "s4", m5: "s4", m6: "s5", m7: "s5", m8: "s6", m9: "s7", m10: "s7", m11: "s6", m12: "s8",
};

// --------------------------------------------------------------- contractors
export const contractors: Contractor[] = [
  { id: "k1", name: "Ustad Rafiq Ahmed", phone: "0300-4127765", cnic: "35202-4412873-1", address: "Township, Lahore", specializationIds: ["wc1", "wc9"], isActive: true },
  { id: "k2", name: "Bashir Steel Fixers", phone: "0321-4870012", cnic: "35201-7781234-5", address: "Shahdara, Lahore", specializationIds: ["wc2"], isActive: true },
  { id: "k3", name: "Shaukat Shuttering Works", phone: "0333-4401928", cnic: "35202-1198734-3", address: "Kot Lakhpat, Lahore", specializationIds: ["wc3"], isActive: true },
  { id: "k4", name: "Akram Electric Works", phone: "0345-4091827", cnic: "35201-6612098-7", address: "Ichhra, Lahore", specializationIds: ["wc4"], isActive: true },
  { id: "k5", name: "Noor Muhammad Plumbing", phone: "0301-4782019", cnic: "35202-3309812-9", address: "Samanabad, Lahore", specializationIds: ["wc5"], isActive: true },
  { id: "k6", name: "Ali Tile & Marble Fixers", phone: "0322-4419087", cnic: "35201-9981276-1", address: "Green Town, Lahore", specializationIds: ["wc6"], isActive: true },
  { id: "k7", name: "Zafar Paint House", phone: "0312-4109876", cnic: "35202-5567123-5", address: "Mozang, Lahore", specializationIds: ["wc7"], isActive: true },
  { id: "k8", name: "Javed Carpentry & Woodworks", phone: "0300-4561290", cnic: "35201-2234098-3", address: "Wahdat Road, Lahore", specializationIds: ["wc8"], isActive: true },
  { id: "k9", name: "Mian Excavation Services", phone: "0334-4012873", cnic: "35202-8890123-7", address: "Bund Road, Lahore", specializationIds: ["wc9"], isActive: false },
];

const SCOPE: Record<string, { inc: string[]; exc: string[]; contractor: string; share: number; phase: number; months: number }> = {
  wc9: { contractor: "k9", share: 0.01, phase: 0, months: 1, inc: ["Excavation for foundations and basement", "Disposal of excavated earth off site", "Levelling and compaction of base"], exc: ["Dewatering", "Termite treatment"] },
  wc1: { contractor: "k1", share: 0.085, phase: 0, months: 5, inc: ["Brick work of all walls", "Concrete for columns, beams and slabs (labour)", "Internal and external plaster", "Curing of all concrete and plaster"], exc: ["Steel fixing", "Shuttering", "Waterproofing treatment"] },
  wc2: { contractor: "k2", share: 0.025, phase: 0, months: 4, inc: ["Cutting, bending and binding of all steel", "Binding wire supplied by contractor"], exc: ["Steel supply", "Welding work"] },
  wc3: { contractor: "k3", share: 0.03, phase: 0, months: 4, inc: ["Shuttering for slabs, beams and columns", "De-shuttering and cleaning", "Props and scaffolding"], exc: ["Plywood sheets (supplied by company)"] },
  wc4: { contractor: "k4", share: 0.03, phase: 1, months: 4, inc: ["Conduit laying in slabs and walls", "Wiring of all points", "DB installation and earthing"], exc: ["Light fixtures supply", "Solar system", "Generator wiring"] },
  wc5: { contractor: "k5", share: 0.025, phase: 1, months: 4, inc: ["Water supply lines (PPR)", "Drainage and sewer lines", "Fixing of sanitary fittings"], exc: ["Sanitary fittings supply", "Water tank supply", "Boring"] },
  wc6: { contractor: "k6", share: 0.03, phase: 2, months: 3, inc: ["Floor tiles in all rooms", "Bathroom wall tiles", "Marble on stairs and porch"], exc: ["Tiles and marble supply", "Grinding and polishing of old floors"] },
  wc7: { contractor: "k7", share: 0.025, phase: 2, months: 3, inc: ["Putty, primer and two coats of paint", "Exterior weather shield", "Polish of wooden doors"], exc: ["Paint supply", "Wallpaper"] },
};

// ------------------------------------------------------------ clients/projects
export const clients: Client[] = [
  { id: "c1", name: "Imran Qureshi", phone: "0300-8421765", email: "imran.qureshi@gmail.com", cnic: "35202-1234567-1", address: "House 41, Street 7, Cavalry Ground, Lahore", createdAt: "2026-01-22" },
  { id: "c2", name: "Dr. Ayesha Malik", phone: "0321-4567812", email: "dr.ayesha.malik@outlook.com", cnic: "35201-7654321-4", address: "Flat 3B, Gulberg Heights, Lahore", createdAt: "2026-03-10" },
  { id: "c3", name: "Khalid Mehmood Developers", phone: "042-35761200", email: "accounts@kmdevelopers.pk", address: "Office 12, Main Boulevard, Gulberg III, Lahore", notes: "Payments by cheque from company account only.", createdAt: "2026-02-18" },
  { id: "c4", name: "Sana & Faisal Rehman", phone: "0333-4128876", email: "faisal.rehman@yahoo.com", cnic: "35202-9988776-3", address: "Johar Town, Lahore", createdAt: "2025-10-20" },
  { id: "c5", name: "Col. (R) Tariq Javed", phone: "0300-5512098", email: "tariq.javed@gmail.com", cnic: "37405-1122334-5", address: "Askari 11, Lahore", createdAt: "2026-05-14" },
  { id: "c6", name: "Nadia Hussain", phone: "0345-4410987", email: "nadia.hussain@gmail.com", address: "Model Town, Lahore", createdAt: "2026-10-28" },
];

export const projects: Project[] = [
  { id: "p1", code: "RC-2601", name: "DHA Phase 6 Residence", clientId: "c1", siteAddress: "Plot 214, Block C, DHA Phase 6", city: "Lahore", plotSize: "1 Kanal", status: "ACTIVE", startDate: "2026-02-10", expectedEndDate: "2027-03-31", contractValue: 68_000_000, siteEngineer: "Engr. Adeel Shah", progress: 58, description: "Double-storey house with basement. Grey structure complete; electrical and plumbing in progress; ground-floor finishing started." },
  { id: "p2", code: "RC-2602", name: "Bahria Town Villa 12-C", clientId: "c2", siteAddress: "Villa 12-C, Sector C, Bahria Town", city: "Lahore", plotSize: "10 Marla", status: "ACTIVE", startDate: "2026-04-01", expectedEndDate: "2027-02-28", contractValue: 32_500_000, siteEngineer: "Engr. Hira Saleem", progress: 41, description: "Single unit, two storeys. Structure complete, services underway." },
  { id: "p3", code: "RC-2603", name: "Gulberg Commercial Plaza", clientId: "c3", siteAddress: "Plot 9, Main Boulevard, Gulberg III", city: "Lahore", plotSize: "2 Kanal", status: "ACTIVE", startDate: "2026-03-15", expectedEndDate: "2027-12-31", contractValue: 145_000_000, siteEngineer: "Engr. Adeel Shah", progress: 27, description: "Basement + ground + 5 floors commercial building. Currently on the 3rd floor slab." },
  { id: "p4", code: "RC-2504", name: "Johar Town House", clientId: "c4", siteAddress: "House 118, Block R-1, Johar Town", city: "Lahore", plotSize: "10 Marla", status: "COMPLETED", startDate: "2025-11-05", expectedEndDate: "2026-08-31", contractValue: 29_000_000, siteEngineer: "Engr. Hira Saleem", progress: 100, description: "Handed over on 30 Aug 2026." },
  { id: "p5", code: "RC-2605", name: "Askari 11 Duplex", clientId: "c5", siteAddress: "Plot 77, Sector B, Askari 11", city: "Lahore", plotSize: "1 Kanal", status: "ON_HOLD", startDate: "2026-06-01", expectedEndDate: "2027-06-30", contractValue: 41_000_000, siteEngineer: "Engr. Adeel Shah", progress: 14, description: "On hold since September at the client's request (drawing revision)." },
  { id: "p6", code: "RC-2606", name: "Model Town Renovation", clientId: "c6", siteAddress: "House 21-A, Block K, Model Town", city: "Lahore", plotSize: "7 Marla", status: "PLANNING", startDate: "2026-12-01", expectedEndDate: "2027-04-30", contractValue: 9_500_000, progress: 0, description: "Full renovation: new kitchen, bathrooms, flooring and paint." },
];

// How far each project has run: [first month, last month, max phase reached].
const RUN: Record<string, { from: string; to: string; maxPhase: number }> = {
  p1: { from: "2026-02-01", to: "2026-11-01", maxPhase: 2 },
  p2: { from: "2026-04-01", to: "2026-11-01", maxPhase: 1 },
  p3: { from: "2026-03-01", to: "2026-11-01", maxPhase: 0 },
  p4: { from: "2025-11-01", to: "2026-08-01", maxPhase: 2 },
  p5: { from: "2026-06-01", to: "2026-08-01", maxPhase: 0 },
};

const PHASE_QTY: Record<number, Record<string, number>> = {
  0: { m1: 200, m2: 3000, m3: 15000, m4: 1000, m5: 750, m12: 20 },
  1: { m1: 80, m3: 5000, m4: 400, m6: 12, m7: 150, m8: 700 },
  2: { m1: 50, m9: 1500, m10: 30, m11: 2, m4: 200 },
};

const BANKS = ["Meezan Bank", "HBL", "UBL", "Bank Alfalah", "MCB Bank", "Allied Bank"];
const PAYEES: Record<string, string[]> = {
  ec1: ["Daily labour (12 persons)", "Daily labour (8 persons)", "Helpers — weekly wages", "Mason helpers — weekly"],
  ec2: ["Mazda loader — material shifting", "Tractor trolley — debris removal", "Shehzore — steel carriage"],
  ec3: ["Concrete mixer rent", "Concrete pump — slab casting", "Excavator hourly rent", "Vibrator & lift rent"],
  ec4: ["LESCO — site electricity bill", "Temporary connection meter bill"],
  ec5: ["Stationery & printing", "Site office tea & supplies", "Drawings printing"],
  ec6: ["LDA map approval fee", "DHA construction fee", "Society NOC fee"],
  ec7: ["Night watchman — monthly salary"],
  ec8: ["Water tanker (3 trips)", "Water tanker (5 trips)"],
  ec9: ["Shovels, pans and tools", "Spirit levels & measuring tapes", "Hardware: nails, binding wire"],
  ec10: ["Site cleaning (one-off)", "Police verification charges", "Generator repair", "Rickshaw fares"],
  ec11: ["Tea & lunch for labour", "Slab casting day — lunch for labour"],
  ec12: ["Sadqa (slab casting)", "Tip to municipal staff"],
};
const EXPENSE_PLAN: [string, number, number, number][] = [
  // category, min, max, probability per month (amounts for a ~30M project)
  ["ec1", 60000, 120000, 1], ["ec1", 50000, 90000, 0.6], ["ec2", 12000, 35000, 0.9], ["ec3", 20000, 60000, 0.7],
  ["ec4", 9000, 22000, 1], ["ec7", 35000, 35000, 1], ["ec8", 6000, 15000, 0.8], ["ec9", 5000, 18000, 0.4],
  ["ec5", 2000, 8000, 0.35], ["ec10", 2000, 12000, 0.6], ["ec11", 4000, 15000, 0.7], ["ec12", 2000, 10000, 0.15],
];

function method(bankShare = 0.7): PaymentMethod {
  const r = rand();
  return r < bankShare ? "BANK_TRANSFER" : r < bankShare + 0.08 ? "CHEQUE" : "CASH";
}

function generate() {
  const clientPayments: ClientPayment[] = [];
  const deliveries: Delivery[] = [];
  const supplierPayments: SupplierPayment[] = [];
  const stockMovements: StockMovement[] = [];
  const expenses: Expense[] = [];
  const contracts: Contract[] = [];
  const contractorPayments: ContractorPayment[] = [];
  let challan = 4100;

  for (const p of projects) {
    const run = RUN[p.id];
    if (!run) continue;
    const f = p.contractValue / 30_000_000;
    const months: string[] = [];
    for (let m = run.from; m <= run.to; m = addMonths(m, 1)) months.push(m);

    // Client payments
    months.forEach((m, k) => {
      const share = k === 0 ? 0.15 : between(0.065, 0.085);
      const amount = roundTo(p.contractValue * share, 50000);
      const mth = method(0.8);
      clientPayments.push({
        id: nextId("cp"), projectId: p.id, date: dayInMonth(m, 1, 10), amount, method: mth,
        bankName: mth === "CASH" ? undefined : pick(BANKS),
        reference: mth === "BANK_TRANSFER" ? `IBFT-${Math.floor(between(100000, 999999))}` : mth === "CHEQUE" ? `CHQ ${Math.floor(between(10000000, 99999999))}` : undefined,
        note: k === 0 ? "Mobilisation advance" : `Running payment — ${new Date(m).toLocaleString("en-GB", { month: "long", timeZone: "UTC" })}`,
      });
    });
    if (p.status === "COMPLETED") {
      const paid = clientPayments.filter((c) => c.projectId === p.id).reduce((s, c) => s + c.amount, 0);
      clientPayments.push({ id: nextId("cp"), projectId: p.id, date: "2026-09-04", amount: p.contractValue - paid, method: "BANK_TRANSFER", bankName: "Meezan Bank", reference: "IBFT-778120", note: "Final settlement after handover" });
    }

    // Deliveries, consumption and supplier payments
    const owed: Record<string, number> = {};
    months.forEach((m, k) => {
      const phase = Math.min(run.maxPhase, k < 4 ? 0 : k < 7 ? 1 : 2);
      const plan = { ...PHASE_QTY[phase] };
      if (phase > 0 && k % 2 === 0) Object.assign(plan, { m1: (plan.m1 ?? 0) + 60 });
      const bySupplier: Record<string, string[]> = {};
      for (const mat of Object.keys(plan)) (bySupplier[SUPPLIER_FOR[mat]] ??= []).push(mat);
      for (const [sid, mats] of Object.entries(bySupplier)) {
        const splits = mats.includes("m1") || mats.includes("m3") ? 2 : 1;
        for (let s = 0; s < splits; s++) {
          const date = dayInMonth(m, s === 0 ? 2 : 15, s === 0 ? 13 : 27);
          const lines = mats.map((mat) => {
            const unitStep = mat === "m3" ? 500 : mat === "m2" ? 50 : mat === "m11" || mat === "m6" ? 1 : 5;
            const quantity = roundTo((plan[mat] * f * between(0.8, 1.2)) / splits, unitStep);
            const rate = Math.round(between(...RATE[mat]) * (mat === "m3" ? 10 : 1)) / (mat === "m3" ? 10 : 1);
            return { materialId: mat, quantity, rate };
          });
          deliveries.push({ id: nextId("dl"), projectId: p.id, supplierId: sid, date, challanNo: `CH-${++challan}`, lines });
          owed[sid] = (owed[sid] ?? 0) + lines.reduce((t, l) => t + l.quantity * l.rate, 0);
          // Consumption/wastage of what was received (never more than received).
          for (const l of lines) {
            if (m.slice(0, 7) === DEMO_TODAY.slice(0, 7)) continue; // this month's material is still in stock
            const used = roundTo(l.quantity * between(0.7, 0.92), l.materialId === "m3" ? 100 : 1);
            stockMovements.push({ id: nextId("sm"), projectId: p.id, materialId: l.materialId, date: date < m.slice(0, 8) + "27" ? m.slice(0, 8) + "27" : date, type: "CONSUMPTION", quantity: used, usedFor: pick(["Ground floor", "First floor", "Basement", "Boundary wall", "Roof slab", "Columns & beams"]) });
            if ((l.materialId === "m1" || l.materialId === "m3" || l.materialId === "m9") && rand() < 0.35) {
              const waste = roundTo(l.quantity * between(0.01, 0.03), l.materialId === "m3" ? 50 : 1);
              stockMovements.push({ id: nextId("sm"), projectId: p.id, materialId: l.materialId, date: m.slice(0, 8) + "28", type: "WASTAGE", quantity: waste, note: pick(["Broken during unloading", "Set due to rain", "Damaged in storage"]) });
            }
          }
        }
      }
      // Pay suppliers at month end. The last month is left partly unpaid.
      const last = k === months.length - 1;
      for (const sid of Object.keys(owed)) {
        if (owed[sid] < 1000) continue;
        const share = last && p.status !== "COMPLETED" ? (rand() < 0.5 ? 0 : 0.4) : between(0.82, 1);
        const amount = Math.floor((owed[sid] * share) / 1000) * 1000;
        if (share === 0 || amount <= 0) continue;
        supplierPayments.push({ id: nextId("sp"), projectId: p.id, supplierId: sid, date: dayInMonth(m, 24, 28), amount, type: "PAYMENT", method: method(0.6), reference: rand() < 0.6 ? `TRX-${Math.floor(between(1000, 9999))}` : undefined });
        owed[sid] -= amount;
      }
    });
    if (p.status === "COMPLETED") {
      for (const sid of Object.keys(owed)) {
        if (owed[sid] >= 1) {
          supplierPayments.push({ id: nextId("sp"), projectId: p.id, supplierId: sid, date: "2026-09-10", amount: Math.round(owed[sid] * 100) / 100, type: "PAYMENT", method: "BANK_TRANSFER", note: "Final settlement" });
          owed[sid] = 0;
        }
      }
    }

    // Contracts and contractor payments
    for (const [wc, sc] of Object.entries(SCOPE)) {
      if (sc.phase > run.maxPhase) continue;
      const startIdx = sc.phase === 0 ? 0 : sc.phase === 1 ? 4 : 7;
      if (startIdx >= months.length) continue;
      const elapsed = months.length - startIdx;
      const done = p.status === "COMPLETED" || elapsed >= sc.months + 1;
      const progress = done ? 100 : p.status === "ON_HOLD" ? Math.min(60, Math.round((elapsed / sc.months) * 100)) : Math.min(95, Math.round((elapsed / sc.months) * 100));
      const amount = roundTo(p.contractValue * sc.share, 10000);
      const start = dayInMonth(months[startIdx], 1, 8);
      const c: Contract = {
        id: nextId("ct"), projectId: p.id, contractorId: sc.contractor, workCategoryId: wc,
        title: `${workCategories.find((w) => w.id === wc)!.name} — ${p.name}`,
        amount, startDate: start, endDate: addMonths(months[startIdx], sc.months).slice(0, 8) + "25",
        status: done ? "COMPLETED" : "ACTIVE", progress, includedScope: sc.inc, excludedScope: sc.exc,
        terms: "Payment against measured work. 10% retention released on completion.",
      };
      contracts.push(c);
      contractorPayments.push({ id: nextId("kp"), contractId: c.id, date: start, amount: roundTo(amount * 0.15, 5000), type: "ADVANCE", method: "CASH", note: "Mobilisation advance" });
      let paid = roundTo(amount * 0.15, 5000);
      for (let i = 1; i <= Math.min(elapsed - 1, sc.months); i++) {
        const target = Math.min(progress, (i / sc.months) * 100) / 100;
        const inst = roundTo(amount * target * 0.9 - paid, 5000);
        if (inst <= 0) continue;
        paid += inst;
        contractorPayments.push({ id: nextId("kp"), contractId: c.id, date: dayInMonth(months[startIdx + i], 5, 20), amount: inst, type: "INSTALLMENT", method: method(0.4), note: `Running bill #${i}` });
      }
      if (done && paid < amount && months[startIdx + sc.months]) {
        contractorPayments.push({ id: nextId("kp"), contractId: c.id, date: dayInMonth(months[Math.min(months.length - 1, startIdx + sc.months)], 20, 27), amount: amount - paid, type: "FINAL", method: "BANK_TRANSFER", note: "Final bill incl. retention" });
      }
    }

    // Site expenses
    months.forEach((m, k) => {
      if (k === 0) expenses.push({ id: nextId("ex"), projectId: p.id, categoryId: "ec6", date: dayInMonth(m, 1, 6), amount: roundTo(120000 * f, 1000), paidTo: pick(PAYEES.ec6), method: "BANK_TRANSFER", description: "Approval fee before starting construction", attachment: { name: "fee-challan.pdf", size: 184320 } });
      for (const [cat, min, max, prob] of EXPENSE_PLAN) {
        if (rand() > prob) continue;
        const scale = cat === "ec7" || cat === "ec4" ? 1 : f;
        const amount = roundTo(between(min, max) * scale, 100);
        expenses.push({
          id: nextId("ex"), projectId: p.id, categoryId: cat, date: dayInMonth(m), amount, paidTo: pick(PAYEES[cat]),
          method: cat === "ec4" ? "BANK_TRANSFER" : rand() < 0.85 ? "CASH" : "BANK_TRANSFER",
          description: cat === "ec7" ? `Salary for ${new Date(m).toLocaleString("en-GB", { month: "long", timeZone: "UTC" })}` : pick(PAYEES[cat]),
          attachment: rand() < 0.45 ? { name: `receipt-${Math.floor(between(1000, 9999))}.jpg`, size: Math.floor(between(90_000, 1_800_000)) } : undefined,
        });
      }
    });
  }

  // Planning project: mobilisation advance already received.
  clientPayments.push({ id: nextId("cp"), projectId: "p6", date: "2026-11-05", amount: 1_500_000, method: "BANK_TRANSFER", bankName: "HBL", reference: "IBFT-551902", note: "Advance on signing" });
  // A supplier advance paid before delivery (shows an advance balance).
  supplierPayments.push({ id: nextId("sp"), projectId: "p2", supplierId: "s7", date: "2026-11-06", amount: 600_000, type: "ADVANCE", method: "BANK_TRANSFER", reference: "TRX-8812", note: "Advance to book floor tiles before price increase" });
  supplierPayments.push({ id: nextId("sp"), projectId: "p3", supplierId: "s2", date: "2026-11-08", amount: 2_000_000, type: "ADVANCE", method: "BANK_TRANSFER", reference: "TRX-9034", note: "Advance for 4th floor slab steel" });

  const contractAdjustments: ContractAdjustment[] = [];
  const adj = (projectId: string, wc: string, type: "EXTRA" | "DEDUCTION", amount: number, date: string, reason: string) => {
    const c = contracts.find((x) => x.projectId === projectId && x.workCategoryId === wc);
    if (c) contractAdjustments.push({ id: nextId("ca"), contractId: c.id, type, amount, date, reason });
  };
  adj("p1", "wc1", "EXTRA", 450000, "2026-05-18", "Boundary wall and servant quarter added");
  adj("p1", "wc2", "DEDUCTION", 60000, "2026-04-02", "Steel wastage above allowed limit");
  adj("p4", "wc6", "EXTRA", 180000, "2026-07-12", "Porch marble work added by client");
  adj("p3", "wc3", "EXTRA", 300000, "2026-08-21", "Extra shuttering for ramp");
  adj("p2", "wc1", "DEDUCTION", 75000, "2026-07-30", "Plaster rework at contractor's cost");

  return { clientPayments, deliveries, supplierPayments, stockMovements, expenses, contracts, contractorPayments, contractAdjustments };
}

const g = generate();

const withdrawals: Withdrawal[] = [
  { id: "w1", partnerId: "pa1", projectId: "p4", date: "2026-06-10", amount: 1_000_000, method: "BANK_TRANSFER", note: "Profit share — Johar Town" },
  { id: "w2", partnerId: "pa2", projectId: "p4", date: "2026-06-10", amount: 1_000_000, method: "BANK_TRANSFER", note: "Profit share — Johar Town" },
  { id: "w3", partnerId: "pa3", projectId: "p4", date: "2026-06-12", amount: 1_000_000, method: "BANK_TRANSFER", note: "Profit share — Johar Town" },
  { id: "w4", partnerId: "pa1", projectId: "p4", date: "2026-09-15", amount: 750_000, method: "BANK_TRANSFER", note: "Final profit share after handover" },
  { id: "w5", partnerId: "pa2", projectId: "p4", date: "2026-09-15", amount: 750_000, method: "BANK_TRANSFER", note: "Final profit share after handover" },
  { id: "w6", partnerId: "pa3", projectId: "p4", date: "2026-09-16", amount: 750_000, method: "CASH", note: "Final profit share after handover" },
  { id: "w7", partnerId: "pa1", projectId: "p1", date: "2026-07-05", amount: 400_000, method: "CASH", note: "Personal — Eid expenses" },
  { id: "w8", partnerId: "pa2", projectId: "p1", date: "2026-08-20", amount: 500_000, method: "BANK_TRANSFER" },
  { id: "w9", partnerId: "pa3", projectId: "p3", date: "2026-10-02", amount: 300_000, method: "BANK_TRANSFER", note: "Car installment" },
  { id: "w10", partnerId: "pa1", projectId: "p3", date: "2026-10-28", amount: 600_000, method: "BANK_TRANSFER" },
];

export function createMockData(): DataState {
  return structuredClone({
    clients, projects, contractors, suppliers, materials, expenseCategories, materialCategories, workCategories,
    clientPayments: g.clientPayments,
    contracts: g.contracts,
    contractAdjustments: g.contractAdjustments,
    contractorPayments: g.contractorPayments,
    deliveries: g.deliveries,
    supplierPayments: g.supplierPayments,
    stockMovements: g.stockMovements,
    expenses: g.expenses,
    partners: [
      { id: "pa1", name: "Hamza Raza", phone: "0300-4000111", sharePercent: 40, userId: "u1" },
      { id: "pa2", name: "Bilal Ahmed", phone: "0321-4000222", sharePercent: 30, userId: "u2" },
      { id: "pa3", name: "Usman Tariq", phone: "0333-4000333", sharePercent: 30, userId: "u3" },
    ],
    withdrawals,
    users: [
      { id: "u1", name: "Hamza Raza", email: "hamza@rohanconstruction.pk", role: "ADMIN", isActive: true, lastLogin: "2026-11-10T09:12:00+05:00" },
      { id: "u2", name: "Bilal Ahmed", email: "bilal@rohanconstruction.pk", role: "PARTNER", isActive: true, lastLogin: "2026-11-08T18:40:00+05:00" },
      { id: "u3", name: "Usman Tariq", email: "usman@rohanconstruction.pk", role: "PARTNER", isActive: true, lastLogin: "2026-11-02T11:05:00+05:00" },
    ],
    settings: {
      companyName: "Rohan Construction",
      companyPhone: "042-35700000",
      companyAddress: "Office 4, Commercial Area, DHA Phase 5, Lahore",
      currencyLabel: "Rs.",
      dateFormat: "DD MMM YYYY",
      lowStockAlerts: true,
    },
  });
}

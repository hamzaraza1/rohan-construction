// Stage 1 (frontend prototype): these shapes describe the mock data.
// They are a starting point for the Stage 2 database schema, not the final one.

export type ID = string;
export type ISODate = string; // "2026-11-09"

export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CHEQUE";

export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED";

export interface Client {
  id: ID;
  name: string;
  phone: string;
  email?: string;
  cnic?: string;
  address?: string;
  notes?: string;
  createdAt: ISODate;
}

/** There is only one project type: With Material Contract. */
export interface Project {
  id: ID;
  code: string;
  name: string;
  clientId: ID;
  siteAddress: string;
  city: string;
  plotSize?: string;
  status: ProjectStatus;
  startDate: ISODate;
  expectedEndDate?: ISODate;
  contractValue: number;
  siteEngineer?: string;
  description?: string;
  progress: number;
}

export interface ClientPayment {
  id: ID;
  projectId: ID;
  date: ISODate;
  amount: number;
  method: PaymentMethod;
  bankName?: string;
  reference?: string;
  note?: string;
  attachment?: AttachmentInfo;
}

export interface Contractor {
  id: ID;
  name: string;
  phone: string;
  cnic?: string;
  address?: string;
  specializationIds: ID[];
  isActive: boolean;
  notes?: string;
}

export type ContractStatus = "ACTIVE" | "COMPLETED" | "TERMINATED";

export interface Contract {
  id: ID;
  projectId: ID;
  contractorId: ID;
  title: string;
  workCategoryId: ID;
  amount: number;
  startDate: ISODate;
  endDate?: ISODate;
  status: ContractStatus;
  progress: number;
  includedScope: string[];
  excludedScope: string[];
  terms?: string;
}

export interface ContractAdjustment {
  id: ID;
  contractId: ID;
  type: "EXTRA" | "DEDUCTION";
  amount: number;
  date: ISODate;
  reason: string;
}

export type ContractorPaymentType = "ADVANCE" | "INSTALLMENT" | "FINAL";

export interface ContractorPayment {
  id: ID;
  contractId: ID;
  date: ISODate;
  amount: number;
  type: ContractorPaymentType;
  method: PaymentMethod;
  reference?: string;
  note?: string;
}

export interface Supplier {
  id: ID;
  name: string;
  contactPerson?: string;
  phone: string;
  address?: string;
  materialCategoryIds: ID[];
  isActive: boolean;
}

export interface Material {
  id: ID;
  name: string;
  categoryId: ID;
  unit: string;
}

export interface DeliveryLine {
  materialId: ID;
  quantity: number;
  rate: number;
}

/** Material received at a site from a supplier. This is the purchase. */
export interface Delivery {
  id: ID;
  projectId: ID;
  supplierId: ID;
  date: ISODate;
  challanNo?: string;
  lines: DeliveryLine[];
  note?: string;
}

export type SupplierPaymentType = "ADVANCE" | "PAYMENT";

export interface SupplierPayment {
  id: ID;
  projectId: ID;
  supplierId: ID;
  date: ISODate;
  amount: number;
  type: SupplierPaymentType;
  method: PaymentMethod;
  reference?: string;
  note?: string;
}

export type StockMovementType = "CONSUMPTION" | "WASTAGE";

export interface StockMovement {
  id: ID;
  projectId: ID;
  materialId: ID;
  date: ISODate;
  type: StockMovementType;
  quantity: number;
  usedFor?: string;
  note?: string;
}

export interface AttachmentInfo {
  name: string;
  size: number;
}

export interface Expense {
  id: ID;
  projectId: ID;
  categoryId: ID;
  date: ISODate;
  amount: number;
  paidTo: string;
  method: PaymentMethod;
  description: string;
  attachment?: AttachmentInfo;
}

export interface Partner {
  id: ID;
  name: string;
  phone?: string;
  sharePercent: number;
  userId?: ID;
}

export interface Withdrawal {
  id: ID;
  partnerId: ID;
  projectId: ID;
  date: ISODate;
  amount: number;
  method: PaymentMethod;
  note?: string;
}

export type Role = "ADMIN" | "PARTNER";

export interface User {
  id: ID;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLogin?: string;
}

export interface Category {
  id: ID;
  name: string;
  isActive: boolean;
  /** Expense categories only: shown in the separate Miscellaneous section. */
  isMiscellaneous?: boolean;
}

export interface AppSettings {
  companyName: string;
  companyPhone: string;
  companyAddress: string;
  currencyLabel: string;
  dateFormat: string;
  lowStockAlerts: boolean;
}

export interface DataState {
  clients: Client[];
  projects: Project[];
  clientPayments: ClientPayment[];
  contractors: Contractor[];
  contracts: Contract[];
  contractAdjustments: ContractAdjustment[];
  contractorPayments: ContractorPayment[];
  suppliers: Supplier[];
  materials: Material[];
  deliveries: Delivery[];
  supplierPayments: SupplierPayment[];
  stockMovements: StockMovement[];
  expenses: Expense[];
  partners: Partner[];
  withdrawals: Withdrawal[];
  users: User[];
  expenseCategories: Category[];
  materialCategories: Category[];
  workCategories: Category[];
  settings: AppSettings;
}

export type CollectionKey = { [K in keyof DataState]: DataState[K] extends unknown[] ? K : never }[keyof DataState];

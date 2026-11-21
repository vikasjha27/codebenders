export type FeeModel = 'monthly' | 'per_session';

export interface Student {
  id: string;
  studentName: string;
  parentName: string;
  parentPhone?: string;
  className: string;
  subject: string;
  feeModel: FeeModel;
  /** Fee in rupees (monthly fee, or per-session fee). */
  feeAmount: number;
  /** Day of month the fee is due, 1–28. */
  dueDay: number;
  active: boolean;
}

/** Stored status is 'Draft' or 'Sent'; the others are derived. See domain/invoiceStatus.ts. */
export type InvoiceStatus = 'Draft' | 'Sent' | 'Partially Paid' | 'Paid' | 'Overdue';

export type ReminderChannel = 'WhatsApp' | 'SMS' | 'Other';

export interface ReminderLog {
  /** ISO datetime. */
  sentAt: string;
  channel: ReminderChannel;
  message: string;
}

export type PaymentMode = 'UPI' | 'Cash' | 'Bank Transfer' | 'Other';

export interface Payment {
  id: string;
  /** Amount in rupees. */
  amount: number;
  /** ISO yyyy-mm-dd. */
  paidOn: string;
  mode: PaymentMode;
}

export interface Invoice {
  id: string;
  studentId: string;
  invoiceNumber: string;
  /** Amount in rupees. */
  amount: number;
  /** ISO yyyy-mm-dd. */
  issueDate: string;
  /** ISO yyyy-mm-dd. */
  dueDate: string;
  /** Amount received so far, in rupees. */
  paidAmount: number;
  status: InvoiceStatus;
  /** Billing cycle or description, e.g. "Nov Class 10 Maths". */
  billingNote?: string;
  reminders?: ReminderLog[];
  payments?: Payment[];
}

export type ExpenseCategory =
  | 'Rent'
  | 'Travel/Fuel'
  | 'Study Materials'
  | 'Internet'
  | 'Tutor Payout'
  | 'Other';

export type BillFrequency = 'monthly' | 'quarterly' | 'yearly' | 'one_time';

export interface Bill {
  id: string;
  name: string;
  category: ExpenseCategory;
  /** Amount in rupees. */
  amount: number;
  frequency: BillFrequency;
  /** ISO yyyy-mm-dd. */
  nextDueDate: string;
  paidForCycle: boolean;
  tutorName?: string;
}

export interface CashSnapshot {
  /** Cash on hand in rupees. */
  balance: number;
  /** ISO yyyy-mm-dd. */
  asOfDate: string;
}

export interface ForecastAssumptions {
  /** Fraction of outstanding amounts expected to be collected, 0–1. */
  expectedCollectionRate: number;
  defaultPaymentDelayDays: number;
}

export interface AppData {
  schemaVersion: number;
  students: Student[];
  invoices: Invoice[];
  bills: Bill[];
  cash: CashSnapshot;
  assumptions: ForecastAssumptions;
}

import { addDays, parseISODate, toISODate } from '../domain/dates';
import { deriveInvoiceStatus } from '../domain/invoiceStatus';
import type { AppData, Bill, Invoice, Student } from '../domain/types';
import { SCHEMA_VERSION } from '../storage/schema';

/**
 * Realistic demo data for an independent home tutor in India.
 * Every date is computed relative to `today`, so the demo always shows
 * paid, partially paid, due-soon, overdue and draft items.
 */

const STUDENTS: Student[] = [
  {
    id: 'stu-01',
    studentName: 'Aarav Sharma',
    parentName: 'Rakesh Sharma',
    parentPhone: '+91 9810000101',
    className: 'Class 6',
    subject: 'Maths',
    feeModel: 'monthly',
    feeAmount: 1800,
    dueDay: 5,
    active: true,
  },
  {
    id: 'stu-02',
    studentName: 'Priya Iyer',
    parentName: 'Ganesh Iyer',
    parentPhone: '+91 9820000102',
    className: 'Class 10',
    subject: 'Maths',
    feeModel: 'monthly',
    feeAmount: 2500,
    dueDay: 10,
    active: true,
  },
  {
    id: 'stu-03',
    studentName: 'Mohammed Faiz',
    parentName: 'Imran Faiz',
    parentPhone: '+91 8800000103',
    className: 'Class 9',
    subject: 'Science',
    feeModel: 'monthly',
    feeAmount: 2200,
    dueDay: 14,
    active: true,
  },
  {
    id: 'stu-04',
    studentName: 'Ananya Reddy',
    parentName: 'Suresh Reddy',
    parentPhone: '+91 7700000104',
    className: 'Class 12',
    subject: 'Chemistry',
    feeModel: 'monthly',
    feeAmount: 3000,
    dueDay: 1,
    active: false,
  },
  {
    id: 'stu-05',
    studentName: 'Kabir Singh',
    parentName: 'Gurpreet Singh',
    parentPhone: '+91 9900000105',
    className: 'Class 11',
    subject: 'Physics',
    feeModel: 'monthly',
    feeAmount: 2800,
    dueDay: 20,
    active: true,
  },
  {
    id: 'stu-06',
    studentName: 'Ishita Gupta',
    parentName: 'Neha Gupta',
    parentPhone: '+91 9711000106',
    className: 'Class 8',
    subject: 'English',
    feeModel: 'monthly',
    feeAmount: 1500,
    dueDay: 7,
    active: true,
  },
  {
    id: 'stu-07',
    studentName: 'Rohan Verma',
    parentName: 'Vikram Verma',
    parentPhone: '+91 8511000107',
    className: 'Class 5',
    subject: 'EVS',
    feeModel: 'per_session',
    feeAmount: 400,
    dueDay: 25,
    active: true,
  },
  {
    id: 'stu-08',
    studentName: 'Sneha Nair',
    parentName: 'Anil Nair',
    parentPhone: '+91 9446000108',
    className: 'Class 10',
    subject: 'Science',
    feeModel: 'monthly',
    feeAmount: 2400,
    dueDay: 12,
    active: true,
  },
  {
    id: 'stu-09',
    studentName: 'Dev Patel',
    parentName: 'Hitesh Patel',
    parentPhone: '+91 9898000109',
    className: 'Class 12 (JEE)',
    subject: 'Maths',
    feeModel: 'monthly',
    feeAmount: 5000,
    dueDay: 28,
    active: true,
  },
  {
    id: 'stu-10',
    studentName: 'Meera Joshi',
    parentName: 'Madhavi Joshi',
    parentPhone: '+91 7738000110',
    className: 'Class 7',
    subject: 'Maths',
    feeModel: 'per_session',
    feeAmount: 350,
    dueDay: 18,
    active: true,
  },
  {
    id: 'stu-11',
    studentName: 'Yash Malhotra',
    parentName: 'Ramesh Malhotra',
    parentPhone: '+91 9318000111',
    className: 'Class 9',
    subject: 'English',
    feeModel: 'monthly',
    feeAmount: 1600,
    dueDay: 22,
    active: true,
  },
  {
    id: 'stu-12',
    studentName: 'Tanvi Desai',
    parentName: 'Bhavesh Desai',
    parentPhone: '+91 8866000112',
    className: 'Class 11',
    subject: 'Accountancy',
    feeModel: 'monthly',
    feeAmount: 2000,
    dueDay: 3,
    active: true,
  },
];

/** Offsets are in calendar days from `today` (negative = in the past). */
interface InvoiceSpec {
  studentId: string;
  amount: number;
  paidAmount: number;
  issueOffset: number;
  dueOffset: number;
  /** Only 'Draft' or 'Sent' are stored; the rest are derived. */
  storedStatus: 'Draft' | 'Sent';
}

const INVOICE_SPECS: InvoiceSpec[] = [
  // 4 Paid
  { studentId: 'stu-01', amount: 1800, paidAmount: 1800, issueOffset: -40, dueOffset: -25, storedStatus: 'Sent' },
  { studentId: 'stu-04', amount: 3000, paidAmount: 3000, issueOffset: -35, dueOffset: -20, storedStatus: 'Sent' },
  { studentId: 'stu-09', amount: 5000, paidAmount: 5000, issueOffset: -30, dueOffset: -15, storedStatus: 'Sent' },
  { studentId: 'stu-08', amount: 2400, paidAmount: 2400, issueOffset: -28, dueOffset: -13, storedStatus: 'Sent' },
  // 2 Partially Paid
  { studentId: 'stu-02', amount: 2500, paidAmount: 1250, issueOffset: -20, dueOffset: -5, storedStatus: 'Sent' },
  { studentId: 'stu-05', amount: 2800, paidAmount: 1120, issueOffset: -18, dueOffset: -3, storedStatus: 'Sent' },
  // 2 Due soon
  { studentId: 'stu-03', amount: 2200, paidAmount: 0, issueOffset: -5, dueOffset: 1, storedStatus: 'Sent' },
  { studentId: 'stu-11', amount: 1600, paidAmount: 0, issueOffset: -4, dueOffset: 2, storedStatus: 'Sent' },
  // 3 Overdue
  { studentId: 'stu-06', amount: 1500, paidAmount: 0, issueOffset: -35, dueOffset: -5, storedStatus: 'Sent' },
  { studentId: 'stu-07', amount: 3200, paidAmount: 0, issueOffset: -40, dueOffset: -12, storedStatus: 'Sent' },
  { studentId: 'stu-12', amount: 2000, paidAmount: 0, issueOffset: -50, dueOffset: -20, storedStatus: 'Sent' },
  // 1 Draft
  { studentId: 'stu-10', amount: 2800, paidAmount: 0, issueOffset: 0, dueOffset: 7, storedStatus: 'Draft' },
];

function buildInvoices(today: string): Invoice[] {
  const year = today.slice(0, 4);
  return INVOICE_SPECS.map((spec, i) => {
    const draft: Invoice = {
      id: `inv-${String(i + 1).padStart(2, '0')}`,
      studentId: spec.studentId,
      invoiceNumber: `TD-${year}-${String(i + 1).padStart(4, '0')}`,
      amount: spec.amount,
      issueDate: addDays(today, spec.issueOffset),
      dueDate: addDays(today, spec.dueOffset),
      paidAmount: spec.paidAmount,
      status: spec.storedStatus,
    };
    // Store exactly what the derivation rule returns, so stored and derived agree.
    return { ...draft, status: deriveInvoiceStatus(draft, today) };
  });
}

/** First day of the month after `today`, as ISO yyyy-mm-dd. */
function firstOfNextMonth(today: string): string {
  const d = parseISODate(today);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 1));
}

function buildBills(today: string): Bill[] {
  return [
    {
      id: 'bill-01',
      name: 'Home/Studio Rent',
      category: 'Rent',
      amount: 12000,
      frequency: 'monthly',
      nextDueDate: firstOfNextMonth(today),
      paidForCycle: false,
    },
    {
      id: 'bill-02',
      name: 'Broadband Internet',
      category: 'Internet',
      amount: 699,
      frequency: 'monthly',
      nextDueDate: addDays(today, 12),
      paidForCycle: true,
    },
    {
      id: 'bill-03',
      name: 'Fuel & Travel',
      category: 'Travel/Fuel',
      amount: 4500,
      frequency: 'monthly',
      nextDueDate: addDays(today, 4),
      paidForCycle: false,
    },
    {
      id: 'bill-04',
      name: 'Study Materials',
      category: 'Study Materials',
      amount: 1800,
      frequency: 'quarterly',
      nextDueDate: addDays(today, 20),
      paidForCycle: false,
    },
    {
      id: 'bill-05',
      name: 'Tutor Payout',
      category: 'Tutor Payout',
      amount: 3000,
      frequency: 'monthly',
      nextDueDate: addDays(today, 9),
      paidForCycle: false,
      tutorName: "Sunita Ma'am (part-time assistant)",
    },
    {
      id: 'bill-06',
      name: 'Printing & Stationery',
      category: 'Other',
      amount: 600,
      frequency: 'one_time',
      nextDueDate: addDays(today, 6),
      paidForCycle: false,
    },
    {
      id: 'bill-07',
      name: 'Electricity Share',
      category: 'Other',
      amount: 900,
      frequency: 'monthly',
      nextDueDate: addDays(today, 15),
      paidForCycle: true,
    },
  ];
}

/** Builds the complete demo dataset for the given ISO `today` (yyyy-mm-dd). */
export function buildSeedData(today: string): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    students: STUDENTS.map((s) => ({ ...s })),
    invoices: buildInvoices(today),
    bills: buildBills(today),
    cash: { balance: 64500, asOfDate: today },
    assumptions: { expectedCollectionRate: 0.85, defaultPaymentDelayDays: 7 },
  };
}

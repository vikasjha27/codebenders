import { parseISODate, toISODate } from './dates';
import type { Invoice } from './types';

export interface CreateInvoiceInput {
  studentId: string;
  /** Amount in rupees. */
  amount: number;
  /** ISO yyyy-mm-dd. */
  issueDate: string;
  /** ISO yyyy-mm-dd. */
  dueDate: string;
  billingNote?: string;
}

export type CreateInvoiceResult =
  | { invoice: Invoice; error?: undefined }
  | { invoice?: undefined; error: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const INVOICE_NUMBER = /^TD-(\d{4})-(\d{4})$/;

/** True when s is a real calendar date in yyyy-mm-dd form (rejects e.g. 2025-02-31). */
function isValidISODate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = parseISODate(s);
  return !Number.isNaN(d.getTime()) && toISODate(d) === s;
}

/** Highest sequence number already used for the given year, or 0. */
function maxSequenceForYear(existing: Invoice[], year: number): number {
  let max = 0;
  for (const inv of existing) {
    const m = INVOICE_NUMBER.exec(inv.invoiceNumber);
    if (!m) continue;
    if (Number(m[1]) !== year) continue;
    const seq = Number(m[2]);
    if (seq > max) max = seq;
  }
  return max;
}

/**
 * Validates input and builds a new invoice with status 'Sent'.
 * Numbering: 'TD-<year>-<4-digit sequence>', continuing from the highest existing number for that year.
 */
export function createInvoice(
  input: CreateInvoiceInput,
  existingInvoices: Invoice[],
  year: number,
): CreateInvoiceResult {
  if (!input.studentId || input.studentId.trim() === '') {
    return { error: 'Please select a student.' };
  }
  const { amount } = input;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Amount must be greater than zero.' };
  }
  if (Math.abs(Math.round(amount * 100) - amount * 100) > 1e-6) {
    return { error: 'Amount can have at most 2 decimal places.' };
  }
  if (!isValidISODate(input.issueDate)) {
    return { error: 'Issue date is not a valid date.' };
  }
  if (!isValidISODate(input.dueDate)) {
    return { error: 'Due date is not a valid date.' };
  }
  if (input.dueDate < input.issueDate) {
    return { error: 'Due date cannot be before the issue date.' };
  }

  const sequence = maxSequenceForYear(existingInvoices, year) + 1;
  const invoiceNumber = `TD-${year}-${String(sequence).padStart(4, '0')}`;
  const id = 'inv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);

  const billingNote = input.billingNote?.trim();

  const invoice: Invoice = {
    id,
    studentId: input.studentId,
    invoiceNumber,
    amount,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    paidAmount: 0,
    status: 'Sent',
    payments: [],
    reminders: [],
    ...(billingNote ? { billingNote } : {}),
  };
  return { invoice };
}

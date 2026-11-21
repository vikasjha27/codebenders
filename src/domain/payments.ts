import { deriveInvoiceStatus } from './invoiceStatus';
import { formatINR } from './money';
import { parseISODate, toISODate } from './dates';
import type { Invoice, Payment, PaymentMode } from './types';

export interface RecordPaymentInput {
  /** Amount in rupees. */
  amount: number;
  /** ISO yyyy-mm-dd. */
  paidOn: string;
  mode: PaymentMode;
}

export type RecordPaymentResult =
  | { invoice: Invoice; error?: undefined }
  | { invoice?: undefined; error: string };

const round2 = (n: number): number => Math.round(n * 100) / 100;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidISODate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = parseISODate(s);
  return !Number.isNaN(d.getTime()) && toISODate(d) === s;
}

/** Rupees still owed on an invoice (amount minus paidAmount, to 2 dp). */
export function outstandingOf(invoice: Invoice): number {
  return round2(invoice.amount - invoice.paidAmount);
}

/**
 * Records a full or partial payment. Returns a new invoice object; the input is not mutated.
 * Status is re-derived from the updated amounts and `today`.
 */
export function recordPayment(
  invoice: Invoice,
  input: RecordPaymentInput,
  today: string,
  paymentId?: string,
): RecordPaymentResult {
  if (deriveInvoiceStatus(invoice, today) === 'Paid') {
    return { error: 'Invoice is already fully paid' };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: 'Payment amount must be greater than zero.' };
  }
  const outstanding = outstandingOf(invoice);
  if (input.amount > outstanding + 0.001) {
    return { error: `Payment is more than the balance due of ${formatINR(outstanding)}` };
  }
  if (!isValidISODate(input.paidOn)) {
    return { error: 'Payment date is not a valid date.' };
  }
  if (input.paidOn > today) {
    return { error: 'Payment date cannot be in the future' };
  }

  const payment: Payment = {
    id: paymentId ?? 'pay-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
    amount: input.amount,
    paidOn: input.paidOn,
    mode: input.mode,
  };

  const updated: Invoice = {
    ...invoice,
    payments: [...(invoice.payments ?? []), payment],
    paidAmount: round2(invoice.paidAmount + input.amount),
  };
  updated.status = deriveInvoiceStatus(updated, today);
  return { invoice: updated };
}

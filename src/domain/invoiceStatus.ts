import { addDays } from './dates';
import type { Invoice, InvoiceStatus } from './types';

/**
 * Derives the effective invoice status. Rule (in order):
 *  0. amount <= 0                     -> stored 'Draft' stays 'Draft', anything else becomes 'Sent'
 *  1. paidAmount >= amount            -> 'Paid'
 *  2. 0 < paidAmount < amount         -> 'Partially Paid'
 *  3. dueDate < today                 -> 'Overdue'
 *  4. otherwise                       -> stored status ('Draft' or 'Sent') is kept
 * Dates are ISO yyyy-mm-dd, so string comparison is chronological.
 */
export function deriveInvoiceStatus(invoice: Invoice, today: string): InvoiceStatus {
  if (invoice.amount <= 0) return invoice.status === 'Draft' ? 'Draft' : 'Sent';
  if (invoice.paidAmount >= invoice.amount) return 'Paid';
  if (invoice.paidAmount > 0) return 'Partially Paid';
  if (invoice.dueDate < today) return 'Overdue';
  return invoice.status;
}

/**
 * True when an open invoice falls due within [today, today + days].
 * Drafts are never due soon (they have not been sent), nor are Paid or Overdue invoices.
 */
export function isDueSoon(invoice: Invoice, today: string, days = 3): boolean {
  if (invoice.status === 'Draft') return false;
  const status = deriveInvoiceStatus(invoice, today);
  if (status === 'Draft' || status === 'Paid' || status === 'Overdue') return false;
  return invoice.dueDate >= today && invoice.dueDate <= addDays(today, days);
}

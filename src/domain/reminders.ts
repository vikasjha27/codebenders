import { daysBetween, formatDMY } from './dates';
import { deriveInvoiceStatus } from './invoiceStatus';
import { formatINR } from './money';
import type { Invoice } from './types';

/**
 * Whole days past the due date. 0 when not yet due, due today, or fully paid.
 * daysBetween(from, to) = to - from, so this is daysBetween(dueDate, today).
 */
export function daysOverdue(invoice: Invoice, today: string): number {
  if (deriveInvoiceStatus(invoice, today) === 'Paid') return 0;
  if (invoice.dueDate >= today) return 0;
  return daysBetween(invoice.dueDate, today);
}

export interface ReminderMessageInput {
  studentName: string;
  parentName: string;
  invoiceNumber: string;
  /** Amount still owed, in rupees. */
  outstanding: number;
  /** ISO yyyy-mm-dd. */
  dueDate: string;
  daysOverdue: number;
  billingNote?: string;
}

const PAYMENT_MODES = 'You can pay by UPI, cash or bank transfer.';
const SIGN_OFF = 'Thank you!';

/**
 * Builds a WhatsApp/SMS-ready reminder. Tone by days overdue:
 *   0        gentle reminder (not yet due or due today)
 *   1–7      polite nudge
 *   8–15     firm reminder, payment asked for this week
 *   16–30    urgent
 *   31+      final notice, asks to clear dues or call to discuss
 */
export function buildReminderMessage(input: ReminderMessageInput): string {
  const { parentName, studentName, invoiceNumber, outstanding, dueDate, daysOverdue: days } = input;
  const note = input.billingNote?.trim();
  const subject = `${studentName}${note ? ` (${note})` : ''} under invoice ${invoiceNumber}`;
  const amount = formatINR(outstanding);
  const due = formatDMY(dueDate);
  const greeting = `Dear ${parentName},`;

  if (days <= 0) {
    return [
      greeting,
      `This is a gentle reminder that the fee for ${subject} is due on ${due}.`,
      `The amount is ${amount}. ${PAYMENT_MODES}`,
      SIGN_OFF,
    ].join('\n\n');
  }
  if (days <= 7) {
    return [
      greeting,
      `Hope you are doing well. A quick nudge on the fee for ${subject}, which was due on ${due} and is now ${days} day${days === 1 ? '' : 's'} past due.`,
      `The balance is ${amount}. ${PAYMENT_MODES}`,
      SIGN_OFF,
    ].join('\n\n');
  }
  if (days <= 15) {
    return [
      greeting,
      `The fee for ${subject} was due on ${due} and is now ${days} days overdue. The balance of ${amount} is still pending.`,
      `Could you please arrange payment this week? ${PAYMENT_MODES}`,
      SIGN_OFF,
    ].join('\n\n');
  }
  if (days <= 30) {
    return [
      greeting,
      `Urgent: the fee for ${subject} was due on ${due} and is now ${days} days overdue. The balance of ${amount} needs to be paid at the earliest.`,
      `Please share the payment as soon as possible. ${PAYMENT_MODES}`,
      SIGN_OFF,
    ].join('\n\n');
  }
  return [
    greeting,
    `This is a final notice. The fee for ${subject} was due on ${due} and is now ${days} days overdue. The balance of ${amount} is still unpaid.`,
    `Please clear the dues, or call me so we can discuss the way forward. ${PAYMENT_MODES}`,
    SIGN_OFF,
  ].join('\n\n');
}

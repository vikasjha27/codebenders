import { addDays, daysBetween, formatDMY } from './dates';
import { deriveInvoiceStatus, isDueSoon } from './invoiceStatus';
import { formatINR } from './money';
import { daysOverdue } from './reminders';
import type { AppData, Invoice } from './types';

export type AlertSeverity = 'critical' | 'high' | 'medium';
export type AlertAction = 'record_payment' | 'reminder';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  invoiceId?: string;
  studentId?: string;
  action: AlertAction;
}

/** An alert plus the rupee amount used for sorting. The amount is not part of the output. */
interface RankedAlert {
  alert: Alert;
  amount: number;
}

const MAX_ALERTS = 10;
const BILL_WINDOW_DAYS = 14;
const DUE_SOON_DAYS = 3;
const SEVERITY_RANK: Record<AlertSeverity, number> = { critical: 0, high: 1, medium: 2 };

const round2 = (n: number): number => Math.round(n * 100) / 100;

function severityForOverdue(days: number): AlertSeverity {
  if (days >= 31) return 'critical';
  if (days >= 16) return 'high';
  return 'medium';
}

/**
 * Alerts for the dashboard, most urgent first, capped at MAX_ALERTS.
 *  - Overdue non-Draft invoices with a balance: 31+ days critical, 16–30 high, 1–15 medium.
 *  - A bill due within 14 days that cash cannot cover while any invoice is overdue: critical.
 *  - Non-Draft invoices due within 3 days: medium.
 * Duplicate ids are dropped (first wins).
 */
export function buildAlerts(data: AppData, today: string): Alert[] {
  const ranked: RankedAlert[] = [];
  const studentName = (id: string): string =>
    data.students.find((s) => s.id === id)?.studentName ?? 'Unknown student';
  const outstandingOf = (inv: Invoice): number => round2(Math.max(0, inv.amount - inv.paidAmount));

  const overdueInvoices = data.invoices.filter(
    (inv) =>
      inv.status !== 'Draft' &&
      deriveInvoiceStatus(inv, today) !== 'Paid' &&
      outstandingOf(inv) > 0 &&
      daysOverdue(inv, today) > 0,
  );

  for (const inv of overdueInvoices) {
    const days = daysOverdue(inv, today);
    const owed = outstandingOf(inv);
    const name = studentName(inv.studentId);
    ranked.push({
      amount: owed,
      alert: {
        id: `overdue-${inv.id}`,
        severity: severityForOverdue(days),
        title: `Chase ${name} — ${formatINR(owed)} overdue ${days} days`,
        detail: `Due ${formatDMY(inv.dueDate)} · ${formatINR(owed)} unpaid`,
        invoiceId: inv.id,
        studentId: inv.studentId,
        action: 'reminder',
      },
    });
  }

  if (overdueInvoices.length > 0) {
    const overdueTotal = round2(overdueInvoices.reduce((sum, inv) => sum + outstandingOf(inv), 0));
    const largest = [...overdueInvoices].sort((a, b) => outstandingOf(b) - outstandingOf(a))[0];
    const windowEnd = addDays(today, BILL_WINDOW_DAYS);
    for (const bill of data.bills) {
      if (bill.paidForCycle) continue;
      if (bill.nextDueDate < today || bill.nextDueDate > windowEnd) continue;
      if (data.cash.balance >= bill.amount) continue;
      ranked.push({
        amount: bill.amount,
        alert: {
          id: `bill-${bill.id}`,
          severity: 'critical',
          title: `${bill.name} of ${formatINR(bill.amount)} due ${formatDMY(bill.nextDueDate)} is not covered by cash`,
          detail: `${formatINR(overdueTotal)} is overdue across ${overdueInvoices.length} invoice(s). Collect it before paying this bill.`,
          invoiceId: largest.id,
          studentId: largest.studentId,
          action: 'record_payment',
        },
      });
    }
  }

  for (const inv of data.invoices) {
    if (!isDueSoon(inv, today, DUE_SOON_DAYS)) continue;
    const n = daysBetween(today, inv.dueDate);
    ranked.push({
      amount: outstandingOf(inv),
      alert: {
        id: `due-${inv.id}`,
        severity: 'medium',
        title: `Due in ${n} days: ${studentName(inv.studentId)}`,
        detail: `${formatINR(outstandingOf(inv))} due ${formatDMY(inv.dueDate)}`,
        invoiceId: inv.id,
        studentId: inv.studentId,
        action: 'reminder',
      },
    });
  }

  const seen = new Set<string>();
  const unique = ranked.filter((r) => {
    if (seen.has(r.alert.id)) return false;
    seen.add(r.alert.id);
    return true;
  });
  unique.sort(
    (a, b) => SEVERITY_RANK[a.alert.severity] - SEVERITY_RANK[b.alert.severity] || b.amount - a.amount,
  );

  return unique.slice(0, MAX_ALERTS).map((r) => r.alert);
}

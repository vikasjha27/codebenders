import { daysOverdue } from './reminders';
import { deriveInvoiceStatus } from './invoiceStatus';
import type { AppData } from './types';

/**
 * Aging buckets, by whole days past the due date (see daysOverdue):
 *   dueSoon    not yet due (0 days overdue and dueDate >= today, including due today)
 *   days1to7   1 to 7 days overdue
 *   days8to15  8 to 15 days overdue
 *   days16to30 16 to 30 days overdue
 *   days31plus 31 or more days overdue
 */
export type ReceivableAging = Record<
  'dueSoon' | 'days1to7' | 'days8to15' | 'days16to30' | 'days31plus',
  { amount: number; count: number }
>;

export interface StudentReceivable {
  studentId: string;
  studentName: string;
  parentName: string;
  /** Total still owed by this student, in rupees. */
  outstanding: number;
  /** Portion of outstanding on invoices past due, in rupees. */
  overdueAmount: number;
  /** Earliest due date among this student's unpaid invoices, ISO yyyy-mm-dd. */
  oldestDueDate?: string;
  /** Largest days-overdue across this student's unpaid invoices. */
  daysOverdue: number;
  invoiceIds: string[];
}

export interface Receivables {
  totalOutstanding: number;
  totalOverdue: number;
  aging: ReceivableAging;
  byStudent: StudentReceivable[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function emptyAging(): ReceivableAging {
  return {
    dueSoon: { amount: 0, count: 0 },
    days1to7: { amount: 0, count: 0 },
    days8to15: { amount: 0, count: 0 },
    days16to30: { amount: 0, count: 0 },
    days31plus: { amount: 0, count: 0 },
  };
}

function bucketFor(days: number, dueDate: string, today: string): keyof ReceivableAging {
  if (days === 0 && dueDate >= today) return 'dueSoon';
  if (days <= 7) return 'days1to7';
  if (days <= 15) return 'days8to15';
  if (days <= 30) return 'days16to30';
  return 'days31plus';
}

/**
 * Who-owes-me view. Only invoices whose derived status is not 'Paid' count.
 * Invoices whose student is missing from data.students are included in totals and aging,
 * but are left out of byStudent.
 */
export function buildReceivables(data: AppData, today: string): Receivables {
  const aging = emptyAging();
  let totalOutstanding = 0;
  let totalOverdue = 0;
  const byId = new Map<string, StudentReceivable>();

  for (const inv of data.invoices) {
    // Drafts have not been sent, so nothing is owed on them yet.
    if (inv.status === 'Draft') continue;
    if (deriveInvoiceStatus(inv, today) === 'Paid') continue;
    const outstanding = round2(inv.amount - inv.paidAmount);
    if (outstanding <= 0) continue;

    const days = daysOverdue(inv, today);
    const bucket = aging[bucketFor(days, inv.dueDate, today)];
    bucket.amount = round2(bucket.amount + outstanding);
    bucket.count += 1;

    totalOutstanding = round2(totalOutstanding + outstanding);
    if (days > 0) totalOverdue = round2(totalOverdue + outstanding);

    const student = data.students.find((s) => s.id === inv.studentId);
    if (!student) continue;

    let entry = byId.get(student.id);
    if (!entry) {
      entry = {
        studentId: student.id,
        studentName: student.studentName,
        parentName: student.parentName,
        outstanding: 0,
        overdueAmount: 0,
        oldestDueDate: undefined,
        daysOverdue: 0,
        invoiceIds: [],
      };
      byId.set(student.id, entry);
    }
    entry.outstanding = round2(entry.outstanding + outstanding);
    if (days > 0) entry.overdueAmount = round2(entry.overdueAmount + outstanding);
    if (entry.oldestDueDate === undefined || inv.dueDate < entry.oldestDueDate) {
      entry.oldestDueDate = inv.dueDate;
    }
    entry.daysOverdue = Math.max(entry.daysOverdue, days);
    entry.invoiceIds.push(inv.id);
  }

  const byStudent = [...byId.values()]
    .filter((e) => e.outstanding > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue || b.outstanding - a.outstanding);

  return { totalOutstanding, totalOverdue, aging, byStudent };
}

import { describe, it, expect } from 'vitest';
import { buildReceivables } from './receivables';
import type { AppData, Invoice, Student } from './types';
import { SCHEMA_VERSION } from '../storage/schema';

const TODAY = '2025-04-15';

const student = (id: string, name: string): Student => ({
  id,
  studentName: name,
  parentName: `Parent of ${name}`,
  className: '10',
  subject: 'Maths',
  feeModel: 'monthly',
  feeAmount: 1000,
  dueDay: 5,
  active: true,
});

const invoice = (
  id: string,
  studentId: string,
  amount: number,
  dueDate: string,
  paidAmount = 0,
): Invoice => ({
  id,
  studentId,
  invoiceNumber: `TD-2025-${id.toUpperCase()}`,
  amount,
  issueDate: '2025-03-01',
  dueDate,
  paidAmount,
  status: 'Sent',
});

// Due dates chosen so daysOverdue against TODAY (2025-04-15) is exactly:
// a: 0 (due today), b: 1, c: 7, d: 8, e: 15, f: 16, g: 30, h: 31
const data: AppData = {
  schemaVersion: SCHEMA_VERSION,
  students: [
    student('stu-a', 'Aanya'),
    student('stu-b', 'Bhavin'),
    student('stu-c', 'Chitra'),
    student('stu-d', 'Dev'),
    student('stu-e', 'Esha'),
    student('stu-f', 'Farhan'),
    student('stu-g', 'Gita'),
    student('stu-h', 'Harsh'),
    student('stu-p', 'Paid Kid'),
  ],
  invoices: [
    invoice('a1', 'stu-a', 1000, '2025-04-15'),
    invoice('b1', 'stu-b', 1000, '2025-04-14'),
    invoice('c1', 'stu-c', 1000, '2025-04-08'),
    invoice('d1', 'stu-d', 1000, '2025-04-07'),
    invoice('e1', 'stu-e', 1000, '2025-03-31'),
    invoice('f1', 'stu-f', 1000, '2025-03-30'),
    invoice('g1', 'stu-g', 1000, '2025-03-16'),
    invoice('h1', 'stu-h', 1000, '2025-03-15'),
    // Extra open invoice for Harsh, 14 days overdue; oldest due date stays 2025-03-15.
    invoice('h2', 'stu-h', 250, '2025-04-01'),
    // Student not in data.students: counted in totals and aging, not in byStudent.
    invoice('x1', 'stu-missing', 300, '2025-03-15'),
    // Fully paid: excluded everywhere.
    invoice('p1', 'stu-p', 500, '2025-03-01', 500),
  ],
  bills: [],
  cash: { balance: 0, asOfDate: '2025-04-01' },
  assumptions: { expectedCollectionRate: 0.85, defaultPaymentDelayDays: 7 },
};

describe('buildReceivables', () => {
  const result = buildReceivables(data, TODAY);

  it('computes totals, counting overdue only past due', () => {
    // Open: 8 x 1000 + 250 + 300 = 8550. Overdue excludes a (due today).
    expect(result.totalOutstanding).toBe(8550);
    expect(result.totalOverdue).toBe(7550);
  });

  it('buckets amounts and counts by days overdue', () => {
    expect(result.aging.dueSoon).toEqual({ amount: 1000, count: 1 });
    expect(result.aging.days1to7).toEqual({ amount: 2000, count: 2 });
    expect(result.aging.days8to15).toEqual({ amount: 2250, count: 3 });
    expect(result.aging.days16to30).toEqual({ amount: 2000, count: 2 });
    expect(result.aging.days31plus).toEqual({ amount: 1300, count: 2 });
  });

  it('sorts byStudent by days overdue, then outstanding, and skips unknown or paid students', () => {
    const ids = result.byStudent.map((s) => s.studentId);
    expect(ids).toEqual([
      'stu-h',
      'stu-g',
      'stu-f',
      'stu-e',
      'stu-d',
      'stu-c',
      'stu-b',
      'stu-a',
    ]);
  });

  it('reports the oldest unpaid due date and combined amounts per student', () => {
    const harsh = result.byStudent.find((s) => s.studentId === 'stu-h')!;
    expect(harsh.outstanding).toBe(1250);
    expect(harsh.overdueAmount).toBe(1250);
    expect(harsh.daysOverdue).toBe(31);
    expect(harsh.oldestDueDate).toBe('2025-03-15');
    expect(harsh.invoiceIds).toEqual(['h1', 'h2']);
    expect(harsh.parentName).toBe('Parent of Harsh');
  });

  it('keeps a not-yet-due student with zero overdue amount', () => {
    const aanya = result.byStudent.find((s) => s.studentId === 'stu-a')!;
    expect(aanya.outstanding).toBe(1000);
    expect(aanya.overdueAmount).toBe(0);
    expect(aanya.daysOverdue).toBe(0);
  });

  it('excludes a Paid invoice', () => {
    expect(result.byStudent.find((s) => s.studentId === 'stu-p')).toBeUndefined();
    expect(result.byStudent.flatMap((s) => s.invoiceIds)).not.toContain('p1');
  });

  it('excludes a Draft invoice from totals, aging and byStudent', () => {
    // Draft for Aanya, 5000 and 30 days past due. Must not count anywhere.
    const draft: Invoice = { ...invoice('dr1', 'stu-a', 5000, '2025-03-16'), status: 'Draft' };
    const withDraft: AppData = { ...data, invoices: [...data.invoices, draft] };
    const r = buildReceivables(withDraft, TODAY);
    expect(r.totalOutstanding).toBe(8550);
    expect(r.totalOverdue).toBe(7550);
    expect(r.aging.days31plus).toEqual({ amount: 1300, count: 2 });
    const aanya = r.byStudent.find((s) => s.studentId === 'stu-a')!;
    expect(aanya.outstanding).toBe(1000);
    expect(aanya.invoiceIds).toEqual(['a1']);
    expect(r.byStudent.flatMap((s) => s.invoiceIds)).not.toContain('dr1');
  });
});

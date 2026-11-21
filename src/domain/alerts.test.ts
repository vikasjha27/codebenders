import { describe, it, expect } from 'vitest';
import { buildAlerts } from './alerts';
import { SCHEMA_VERSION } from '../storage/schema';
import type { AppData, Bill, Invoice, Student } from './types';

// Today = 2025-04-15. Days overdue against today: 35 -> 03-11, 20 -> 03-26, 5 -> 04-10.
const TODAY = '2025-04-15';

const student = (id: string, name: string): Student => ({
  id,
  studentName: name,
  parentName: `Parent of ${name}`,
  className: '10',
  subject: 'Maths',
  feeModel: 'monthly',
  feeAmount: 2000,
  dueDay: 5,
  active: true,
});

const invoice = (id: string, dueDate: string, extra: Partial<Invoice> = {}): Invoice => ({
  id,
  studentId: 'stu-1',
  invoiceNumber: `TD-${id.toUpperCase()}`,
  amount: 1000,
  issueDate: '2025-03-01',
  dueDate,
  paidAmount: 0,
  status: 'Sent',
  ...extra,
});

const makeData = (invoices: Invoice[], bills: Bill[] = [], balance = 100000): AppData => ({
  schemaVersion: SCHEMA_VERSION,
  students: [student('stu-1', 'Aanya'), student('stu-2', 'Bhavin')],
  invoices,
  bills,
  cash: { balance, asOfDate: TODAY },
  assumptions: { expectedCollectionRate: 0.85, defaultPaymentDelayDays: 7 },
});

const find = (alerts: ReturnType<typeof buildAlerts>, id: string) => alerts.find((a) => a.id === id);

describe('buildAlerts: overdue severity', () => {
  it('is critical for 31+ days overdue', () => {
    const alerts = buildAlerts(makeData([invoice('o35', '2025-03-11')]), TODAY);
    expect(find(alerts, 'overdue-o35')?.severity).toBe('critical');
  });

  it('is high for 16–30 days overdue', () => {
    const alerts = buildAlerts(makeData([invoice('o20', '2025-03-26')]), TODAY);
    expect(find(alerts, 'overdue-o20')?.severity).toBe('high');
  });

  it('is medium for 1–15 days overdue, with reminder action and invoice/student ids', () => {
    const alerts = buildAlerts(makeData([invoice('o5', '2025-04-10')]), TODAY);
    const a = find(alerts, 'overdue-o5');
    expect(a?.severity).toBe('medium');
    expect(a?.action).toBe('reminder');
    expect(a?.invoiceId).toBe('o5');
    expect(a?.studentId).toBe('stu-1');
    expect(a?.title).toContain('Aanya');
  });
});

describe('buildAlerts: due soon', () => {
  it('flags a Sent invoice due in 2 days as medium', () => {
    const alerts = buildAlerts(makeData([invoice('d2', '2025-04-17')]), TODAY);
    const a = find(alerts, 'due-d2');
    expect(a?.severity).toBe('medium');
    expect(a?.title).toBe('Due in 2 days: Aanya');
    expect(a?.action).toBe('reminder');
  });
});

describe('buildAlerts: Draft invoices', () => {
  it('produces no alert for a Draft invoice with a past due date', () => {
    const alerts = buildAlerts(makeData([invoice('dr', '2025-03-01', { status: 'Draft' })]), TODAY);
    expect(alerts).toEqual([]);
  });
});

describe('buildAlerts: bill impact', () => {
  it('raises a critical bill alert when cash cannot cover a bill due in 5 days while an invoice is overdue', () => {
    const rent: Bill = {
      id: 'rent',
      name: 'Rent',
      category: 'Rent',
      amount: 15000,
      frequency: 'monthly',
      nextDueDate: '2025-04-20',
      paidForCycle: false,
    };
    const data = makeData([invoice('o35', '2025-03-11')], [rent], 1000);
    const alerts = buildAlerts(data, TODAY);
    const a = find(alerts, 'bill-rent');
    expect(a?.severity).toBe('critical');
    expect(a?.action).toBe('record_payment');
    expect(a?.invoiceId).toBe('o35');
    expect(a?.studentId).toBe('stu-1');
  });

  it('does not raise a bill alert when cash covers the bill', () => {
    const rent: Bill = {
      id: 'rent',
      name: 'Rent',
      category: 'Rent',
      amount: 15000,
      frequency: 'monthly',
      nextDueDate: '2025-04-20',
      paidForCycle: false,
    };
    const alerts = buildAlerts(makeData([invoice('o35', '2025-03-11')], [rent], 20000), TODAY);
    expect(find(alerts, 'bill-rent')).toBeUndefined();
  });
});

describe('buildAlerts: ordering and limits', () => {
  it('sorts critical before high before medium and has no duplicate ids', () => {
    const alerts = buildAlerts(
      makeData([
        invoice('o5', '2025-04-10'),
        invoice('o35', '2025-03-11'),
        invoice('o20', '2025-03-26'),
      ]),
      TODAY,
    );
    expect(alerts.map((a) => a.severity)).toEqual(['critical', 'high', 'medium']);
    expect(new Set(alerts.map((a) => a.id)).size).toBe(alerts.length);
  });

  it('caps the list at 10 alerts', () => {
    const many = Array.from({ length: 15 }, (_, i) => invoice(`x${i}`, '2025-04-10'));
    expect(buildAlerts(makeData(many), TODAY)).toHaveLength(10);
  });
});

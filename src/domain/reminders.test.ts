import { describe, it, expect } from 'vitest';
import { buildReminderMessage, daysOverdue } from './reminders';
import { formatINR } from './money';
import type { Invoice } from './types';

const TODAY = '2025-04-15';

const invoice: Invoice = {
  id: 'inv-1',
  studentId: 'stu-1',
  invoiceNumber: 'TD-2025-0007',
  amount: 1500,
  issueDate: '2025-04-01',
  dueDate: '2025-04-10',
  paidAmount: 0,
  status: 'Sent',
};

const baseInput = {
  studentName: 'Aarav',
  parentName: 'Mrs. Sharma',
  invoiceNumber: 'TD-2025-0007',
  outstanding: 1500,
  dueDate: '2025-04-10',
  billingNote: 'Nov Class 10 Maths',
};

describe('daysOverdue', () => {
  it('is 0 when the invoice is not yet due', () => {
    expect(daysOverdue({ ...invoice, dueDate: '2025-04-20' }, TODAY)).toBe(0);
  });

  it('is 0 when the invoice is due today', () => {
    expect(daysOverdue({ ...invoice, dueDate: TODAY }, TODAY)).toBe(0);
  });

  it('is 0 when the invoice is Paid, even if past due', () => {
    expect(daysOverdue({ ...invoice, paidAmount: 1500, status: 'Paid' }, TODAY)).toBe(0);
  });

  it('counts whole days past the due date', () => {
    expect(daysOverdue({ ...invoice, dueDate: '2025-04-10' }, TODAY)).toBe(5);
  });
});

describe('buildReminderMessage', () => {
  it('includes the formatted amount, invoice number and billing note', () => {
    const msg = buildReminderMessage({ ...baseInput, daysOverdue: 0 });
    expect(msg).toContain('₹');
    expect(msg).toContain(formatINR(1500));
    expect(msg).toContain('TD-2025-0007');
    expect(msg).toContain('Nov Class 10 Maths');
    expect(msg).toContain('10/04/2025');
    expect(msg).toContain('Mrs. Sharma');
    expect(msg).toContain('UPI, cash or bank transfer');
  });

  it('omits the billing note parentheses when no note is given', () => {
    const msg = buildReminderMessage({ ...baseInput, billingNote: undefined, daysOverdue: 3 });
    expect(msg).not.toContain('()');
    expect(msg).not.toContain('Nov Class 10 Maths');
  });

  it('uses a different tone at each tier boundary', () => {
    const days = [0, 7, 8, 15, 16, 30, 31];
    const messages = days.map((d) => buildReminderMessage({ ...baseInput, daysOverdue: d }));
    expect(new Set(messages).size).toBe(days.length);
  });

  it('is a final notice at 31 days and not at 0 days', () => {
    const due = buildReminderMessage({ ...baseInput, daysOverdue: 0 });
    const final = buildReminderMessage({ ...baseInput, daysOverdue: 31 });
    expect(final).toContain('final');
    expect(due).not.toContain('final');
    expect(due).not.toBe(final);
  });
});

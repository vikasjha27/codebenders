import { describe, it, expect } from 'vitest';
import { outstandingOf, recordPayment } from './payments';
import type { Invoice } from './types';

const TODAY = '2025-04-05';

const sent: Invoice = {
  id: 'inv-1',
  studentId: 'stu-1',
  invoiceNumber: 'TD-2025-0001',
  amount: 1000,
  issueDate: '2025-04-01',
  dueDate: '2025-04-10',
  paidAmount: 0,
  status: 'Sent',
  payments: [],
  reminders: [],
};

describe('outstandingOf', () => {
  it('returns amount minus paidAmount', () => {
    expect(outstandingOf({ ...sent, paidAmount: 400 })).toBe(600);
  });
});

describe('recordPayment', () => {
  it('moves Sent -> Partially Paid -> Paid across two payments', () => {
    const first = recordPayment(sent, { amount: 400, paidOn: '2025-04-03', mode: 'UPI' }, TODAY, 'p1');
    expect(first.error).toBeUndefined();
    expect(first.invoice?.status).toBe('Partially Paid');
    expect(first.invoice?.paidAmount).toBe(400);

    const second = recordPayment(first.invoice!, { amount: 600, paidOn: TODAY, mode: 'Cash' }, TODAY, 'p2');
    expect(second.error).toBeUndefined();
    expect(second.invoice?.status).toBe('Paid');
    expect(second.invoice?.paidAmount).toBe(1000);
    expect(second.invoice?.payments).toHaveLength(2);
    expect(second.invoice?.payments?.[1]).toEqual({ id: 'p2', amount: 600, paidOn: TODAY, mode: 'Cash' });
  });

  it('rejects an overpayment with a balance message', () => {
    const result = recordPayment(sent, { amount: 1200, paidOn: TODAY, mode: 'UPI' }, TODAY);
    expect(result.invoice).toBeUndefined();
    expect(result.error).toContain('more than the balance');
  });

  it('rejects a payment dated in the future', () => {
    const result = recordPayment(sent, { amount: 100, paidOn: '2025-04-06', mode: 'UPI' }, TODAY);
    expect(result.invoice).toBeUndefined();
    expect(result.error).toContain('future');
  });

  it('rejects a payment on an invoice that is already Paid', () => {
    const paid: Invoice = { ...sent, paidAmount: 1000, status: 'Paid' };
    const result = recordPayment(paid, { amount: 100, paidOn: TODAY, mode: 'Cash' }, TODAY);
    expect(result.invoice).toBeUndefined();
    expect(result.error).toContain('already fully paid');
  });

  it('does not mutate the original invoice', () => {
    const snapshot = JSON.parse(JSON.stringify(sent));
    recordPayment(sent, { amount: 400, paidOn: TODAY, mode: 'UPI' }, TODAY, 'p1');
    expect(sent).toEqual(snapshot);
  });
});

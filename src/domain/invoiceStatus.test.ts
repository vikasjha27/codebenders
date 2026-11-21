import { describe, it, expect } from 'vitest';
import { deriveInvoiceStatus, isDueSoon } from './invoiceStatus';
import type { Invoice } from './types';

const base: Invoice = {
  id: 'inv-1',
  studentId: 'stu-1',
  invoiceNumber: 'TD-0001',
  amount: 2000,
  issueDate: '2025-04-01',
  dueDate: '2025-04-10',
  paidAmount: 0,
  status: 'Sent',
};

const TODAY = '2025-04-05';

describe('deriveInvoiceStatus', () => {
  it('returns Paid when paidAmount >= amount', () => {
    expect(deriveInvoiceStatus({ ...base, paidAmount: 2000 }, TODAY)).toBe('Paid');
    expect(deriveInvoiceStatus({ ...base, paidAmount: 2500 }, '2025-06-01')).toBe('Paid');
  });

  it('does not return Paid for a zero-amount invoice', () => {
    expect(deriveInvoiceStatus({ ...base, amount: 0, paidAmount: 0, status: 'Sent' }, TODAY)).not.toBe('Paid');
    expect(deriveInvoiceStatus({ ...base, amount: 0, paidAmount: 0, status: 'Sent' }, TODAY)).toBe('Sent');
    expect(deriveInvoiceStatus({ ...base, amount: 0, paidAmount: 0, status: 'Draft' }, TODAY)).toBe('Draft');
  });

  it('returns Partially Paid when 0 < paidAmount < amount', () => {
    expect(deriveInvoiceStatus({ ...base, paidAmount: 500 }, TODAY)).toBe('Partially Paid');
  });

  it('returns Overdue when past due and unpaid', () => {
    expect(deriveInvoiceStatus({ ...base, dueDate: '2025-04-01' }, TODAY)).toBe('Overdue');
  });

  it('keeps Sent when not yet due', () => {
    expect(deriveInvoiceStatus({ ...base, status: 'Sent' }, TODAY)).toBe('Sent');
  });

  it('keeps Draft when not yet due', () => {
    expect(deriveInvoiceStatus({ ...base, status: 'Draft' }, TODAY)).toBe('Draft');
  });
});

describe('isDueSoon', () => {
  it('is true for open invoices due within the window', () => {
    expect(isDueSoon({ ...base, dueDate: '2025-04-08' }, TODAY)).toBe(true);
    expect(isDueSoon({ ...base, dueDate: TODAY }, TODAY)).toBe(true);
  });

  it('is false outside the window, for paid, or for overdue', () => {
    expect(isDueSoon({ ...base, dueDate: '2025-04-09' }, TODAY)).toBe(false);
    expect(isDueSoon({ ...base, dueDate: '2025-04-08', paidAmount: 2000 }, TODAY)).toBe(false);
    expect(isDueSoon({ ...base, dueDate: '2025-04-01' }, TODAY)).toBe(false);
  });

  it('is false for a Draft invoice due in 2 days', () => {
    expect(isDueSoon({ ...base, status: 'Draft', dueDate: '2025-04-07' }, TODAY, 3)).toBe(false);
  });

  it('is true for a Sent invoice due in 2 days', () => {
    expect(isDueSoon({ ...base, status: 'Sent', dueDate: '2025-04-07' }, TODAY, 3)).toBe(true);
  });
});

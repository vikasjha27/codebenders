import { describe, it, expect } from 'vitest';
import { createInvoice } from './invoiceOps';
import type { Invoice } from './types';

const existing2025: Invoice = {
  id: 'inv-old',
  studentId: 'stu-1',
  invoiceNumber: 'TD-2025-0001',
  amount: 1000,
  issueDate: '2025-03-01',
  dueDate: '2025-03-10',
  paidAmount: 0,
  status: 'Sent',
};

const valid = {
  studentId: 'stu-1',
  amount: 1500,
  issueDate: '2025-04-01',
  dueDate: '2025-04-10',
  billingNote: '  Nov Class 10 Maths  ',
};

describe('createInvoice', () => {
  it('creates a Sent invoice with zero paid amount and trimmed billing note', () => {
    const result = createInvoice(valid, [], 2025);
    expect(result.error).toBeUndefined();
    expect(result.invoice?.status).toBe('Sent');
    expect(result.invoice?.paidAmount).toBe(0);
    expect(result.invoice?.payments).toEqual([]);
    expect(result.invoice?.reminders).toEqual([]);
    expect(result.invoice?.billingNote).toBe('Nov Class 10 Maths');
    expect(result.invoice?.invoiceNumber).toBe('TD-2025-0001');
  });

  it('continues numbering from the highest existing sequence for the year', () => {
    const first = createInvoice(valid, [], 2025).invoice!;
    expect(first.invoiceNumber).toBe('TD-2025-0001');
    const second = createInvoice(valid, [existing2025], 2025).invoice!;
    expect(second.invoiceNumber).toBe('TD-2025-0002');
    const third = createInvoice(valid, [existing2025, second], 2025).invoice!;
    expect(third.invoiceNumber).toBe('TD-2025-0003');
  });

  it('ignores invoices from other years when numbering', () => {
    const other: Invoice = { ...existing2025, invoiceNumber: 'TD-2024-0009' };
    const result = createInvoice(valid, [other], 2025).invoice!;
    expect(result.invoiceNumber).toBe('TD-2025-0001');
  });

  it('rejects an amount of 0', () => {
    expect(createInvoice({ ...valid, amount: 0 }, [], 2025).error).toBeTruthy();
  });

  it('rejects a negative amount', () => {
    expect(createInvoice({ ...valid, amount: -500 }, [], 2025).error).toBeTruthy();
  });

  it('rejects an amount with more than 2 decimal places', () => {
    expect(createInvoice({ ...valid, amount: 1.234 }, [], 2025).error).toBeTruthy();
  });

  it('accepts an amount with 2 decimal places', () => {
    expect(createInvoice({ ...valid, amount: 99.99 }, [], 2025).error).toBeUndefined();
  });

  it('rejects a due date before the issue date', () => {
    const result = createInvoice({ ...valid, dueDate: '2025-03-31' }, [], 2025);
    expect(result.invoice).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it('rejects a missing studentId', () => {
    expect(createInvoice({ ...valid, studentId: '' }, [], 2025).error).toBeTruthy();
  });
});

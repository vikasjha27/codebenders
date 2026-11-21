import { describe, it, expect } from 'vitest';
import { buildSeedData } from './seedData';
import { deriveInvoiceStatus, isDueSoon } from '../domain/invoiceStatus';
import { formatINR } from '../domain/money';

const TODAY = '2025-04-15';

describe('buildSeedData', () => {
  const data = buildSeedData(TODAY);

  it('seeds at least 11 students', () => {
    expect(data.students.length).toBeGreaterThanOrEqual(11);
  });

  it('includes at least one Paid invoice', () => {
    expect(data.invoices.some((i) => deriveInvoiceStatus(i, TODAY) === 'Paid')).toBe(true);
  });

  it('includes at least one Partially Paid invoice', () => {
    expect(data.invoices.some((i) => deriveInvoiceStatus(i, TODAY) === 'Partially Paid')).toBe(true);
  });

  it('includes at least one Overdue invoice', () => {
    expect(data.invoices.some((i) => deriveInvoiceStatus(i, TODAY) === 'Overdue')).toBe(true);
  });

  it('includes at least one due-soon invoice', () => {
    expect(data.invoices.some((i) => isDueSoon(i, TODAY))).toBe(true);
  });

  it('stores the status that deriveInvoiceStatus returns', () => {
    for (const inv of data.invoices) {
      expect(inv.status).toBe(deriveInvoiceStatus(inv, TODAY));
    }
  });

  it('formats seeded cash balance with INR grouping', () => {
    const out = formatINR(data.cash.balance).replace(/[\u00a0\u202f]/g, ' ');
    expect(out).toContain('₹64,500');
  });
});

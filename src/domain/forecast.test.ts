import { describe, it, expect } from 'vitest';
import { cashCurve, forecastCash } from './forecast';
import type { Bill, ForecastAssumptions, Invoice } from './types';

// Today = 2025-04-01, horizon 30 days -> limit 2025-05-01. Collection rate 0.5.
const invoices: Invoice[] = [
  // A: unpaid, due in window -> 10000 * 0.5 = 5000
  { id: 'A', studentId: 's1', invoiceNumber: 'TD-1', amount: 10000, issueDate: '2025-03-25', dueDate: '2025-04-10', paidAmount: 0, status: 'Sent' },
  // B: partially paid, already overdue -> (5000 - 2000) * 0.5 = 1500
  { id: 'B', studentId: 's2', invoiceNumber: 'TD-2', amount: 5000, issueDate: '2025-03-01', dueDate: '2025-03-20', paidAmount: 2000, status: 'Sent' },
  // C: due after the horizon -> excluded
  { id: 'C', studentId: 's3', invoiceNumber: 'TD-3', amount: 8000, issueDate: '2025-04-01', dueDate: '2025-06-01', paidAmount: 0, status: 'Sent' },
  // D: fully paid -> excluded
  { id: 'D', studentId: 's4', invoiceNumber: 'TD-4', amount: 4000, issueDate: '2025-03-01', dueDate: '2025-03-15', paidAmount: 4000, status: 'Sent' },
  // E: Draft, due in window -> excluded unless includeDrafts
  { id: 'E', studentId: 's5', invoiceNumber: 'TD-5', amount: 3000, issueDate: '2025-03-25', dueDate: '2025-04-10', paidAmount: 0, status: 'Draft' },
];

const bills: Bill[] = [
  // R: unpaid rent due in window -> 15000 (next cycle 2025-05-05 is outside the window)
  { id: 'R', name: 'Rent', category: 'Rent', amount: 15000, frequency: 'monthly', nextDueDate: '2025-04-05', paidForCycle: false },
  // I: already paid this cycle -> 04-28 (next cycle) is in the window -> 1000
  { id: 'I', name: 'Internet', category: 'Internet', amount: 1000, frequency: 'monthly', nextDueDate: '2025-03-28', paidForCycle: true },
  // Y: yearly, due after horizon -> excluded
  { id: 'Y', name: 'Software', category: 'Other', amount: 20000, frequency: 'yearly', nextDueDate: '2025-07-01', paidForCycle: false },
];

const assumptions: ForecastAssumptions = { expectedCollectionRate: 0.5, defaultPaymentDelayDays: 7 };
const cash = { balance: 10000, asOfDate: '2025-04-01' };
const TODAY = '2025-04-01';

describe('forecastCash', () => {
  it('computes a hand-checked 30-day projection', () => {
    const result = forecastCash({ invoices, bills, cash, assumptions }, TODAY, 30);
    expect(result.horizonDays).toBe(30);
    // Collections: A 5000 + B 1500 (Draft E excluded).
    expect(result.expectedCollections).toBe(6500);
    // Bills: R 15000 + Internet next cycle 04-28 1000.
    expect(result.upcomingBills).toBe(16000);
    expect(result.projectedBalance).toBe(500);
  });

  it('excludes Draft invoices from expected collections unless includeDrafts is set', () => {
    const base = forecastCash({ invoices, bills, cash, assumptions }, TODAY, 30);
    expect(base.expectedCollections).toBe(6500);
    const withDrafts = forecastCash({ invoices, bills, cash, assumptions }, TODAY, 30, { includeDrafts: true });
    // Draft E: 3000 * 0.5 = 1500 added.
    expect(withDrafts.expectedCollections).toBe(8000);
  });

  it('counts a monthly bill once in 30 days and three times in 90 days', () => {
    // Rent due today+5 (2025-04-06): occurrences 04-06, 05-06, 06-06 (07-06 is past 06-30).
    const rent: Bill[] = [
      { id: 'M', name: 'Rent', category: 'Rent', amount: 5000, frequency: 'monthly', nextDueDate: '2025-04-06', paidForCycle: false },
    ];
    const input = { invoices: [], bills: rent, cash, assumptions };
    expect(forecastCash(input, TODAY, 30).upcomingBills).toBe(5000);
    expect(forecastCash(input, TODAY, 90).upcomingBills).toBe(15000);
  });

  it('skips the current cycle of a paid monthly bill', () => {
    const paid: Bill[] = [
      { id: 'M', name: 'Rent', category: 'Rent', amount: 5000, frequency: 'monthly', nextDueDate: '2025-04-06', paidForCycle: true },
    ];
    const input = { invoices: [], bills: paid, cash, assumptions };
    // 04-06 is skipped; 05-06 is outside the 30-day window but inside 60 days.
    expect(forecastCash(input, TODAY, 30).upcomingBills).toBe(0);
    expect(forecastCash(input, TODAY, 60).upcomingBills).toBe(5000);
  });

  it('keeps minimumBalance at or below projectedBalance', () => {
    const result = forecastCash({ invoices, bills, cash, assumptions }, TODAY, 90);
    expect(result.minimumBalance).toBeLessThanOrEqual(result.projectedBalance);
  });

  it('cashCurve has one point per day and ends at the projected balance', () => {
    const input = { invoices, bills, cash, assumptions };
    const curve = cashCurve(input, TODAY, 30);
    expect(curve).toHaveLength(31);
    // Day 0 holds today's events: overdue invoice B (1500) is placed on today.
    expect(curve[0]).toMatchObject({ day: 0, date: '2025-04-01', inflow: 1500, outflow: 0, balance: 11500 });
    expect(curve[30].balance).toBeCloseTo(forecastCash(input, TODAY, 30).projectedBalance, 6);
  });
});

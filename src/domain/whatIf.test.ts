import { describe, it, expect } from 'vitest';
import { runWhatIf, DEFAULT_SCENARIO, type WhatIfScenario } from './whatIf';
import { SCHEMA_VERSION } from '../storage/schema';
import type { AppData, Invoice, Student } from './types';

// Today = 2025-01-15, horizon 30 days -> limit 2025-02-14. Collection rate 0.5.
// Choosing January keeps a monthly bill from today to the next cycle (02-15) outside the 30-day window.
const TODAY = '2025-01-15';

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

// L1: late student (stu-l) owes 10000, due today+5 (2025-01-20) -> 10000 * 0.5 = 5000 on 01-20.
// M1: other student (stu-m) owes 2000, due 2025-01-18 -> 2000 * 0.5 = 1000 on 01-18.
const lateInvoice: Invoice = {
  id: 'L1',
  studentId: 'stu-l',
  invoiceNumber: 'TD-L1',
  amount: 10000,
  issueDate: '2025-01-01',
  dueDate: '2025-01-20',
  paidAmount: 0,
  status: 'Sent',
};
const otherInvoice: Invoice = {
  id: 'M1',
  studentId: 'stu-m',
  invoiceNumber: 'TD-M1',
  amount: 2000,
  issueDate: '2025-01-01',
  dueDate: '2025-01-18',
  paidAmount: 0,
  status: 'Sent',
};

const data: AppData = {
  schemaVersion: SCHEMA_VERSION,
  students: [student('stu-l', 'Late Payer'), student('stu-m', 'Other')],
  invoices: [lateInvoice, otherInvoice],
  bills: [],
  cash: { balance: 5000, asOfDate: TODAY },
  assumptions: { expectedCollectionRate: 0.5, defaultPaymentDelayDays: 7 },
};

const scenario = (overrides: Partial<WhatIfScenario>): WhatIfScenario => ({
  ...DEFAULT_SCENARIO,
  lateDays: 0,
  newStudentCount: 0,
  extraMonthlyExpense: 0,
  ...overrides,
});

describe('runWhatIf', () => {
  it('baseline 30-day forecast is 6000 collections and 11000 projected', () => {
    // Collections 5000 (L1) + 1000 (M1) = 6000. Projected = 5000 + 6000 - 0 = 11000.
    const r = runWhatIf(data, TODAY, 30, scenario({}));
    expect(r.baseline.expectedCollections).toBe(6000);
    expect(r.baseline.projectedBalance).toBe(11000);
    expect(r.simulated.projectedBalance).toBe(11000);
    expect(r.deltaProjected).toBe(0);
  });

  it('defaults the late student to the largest outstanding balance', () => {
    const r = runWhatIf(data, TODAY, 30, scenario({}));
    expect(r.lateStudentId).toBe('stu-l');
  });

  it('a late payment past the window removes that student from 30-day collections', () => {
    // lateDays 40: L1 moves 01-20 -> 03-01, outside 02-14. Collections drop to M1 only: 1000.
    // Projected = 5000 + 1000 = 6000, so delta = -5000.
    const r = runWhatIf(data, TODAY, 30, scenario({ lateDays: 40 }));
    expect(r.simulated.expectedCollections).toBe(1000);
    expect(r.deltaProjected).toBe(-5000);
  });

  it('one new student raises simulated expectedCollections', () => {
    // Start = 01-15 + 14 = 01-29 (in window). One fee of 2000 * 0.5 = 1000 counted once in 30 days.
    // Simulated collections = 6000 + 1000 = 7000.
    const r = runWhatIf(data, TODAY, 30, scenario({ newStudentCount: 1, newStudentMonthlyFee: 2000, newStudentStartDelayDays: 14 }));
    expect(r.simulated.expectedCollections).toBe(7000);
    expect(r.simulated.expectedCollections).toBeGreaterThan(r.baseline.expectedCollections);
  });

  it('a 5000 monthly expense lowers projectedBalance by 5000 on a 30-day horizon', () => {
    // Monthly outflow from today: 01-15 is in window; 02-15 is past 02-14. Exactly one occurrence.
    const r = runWhatIf(data, TODAY, 30, scenario({ extraMonthlyExpense: 5000 }));
    expect(r.simulated.upcomingBills).toBe(5000);
    expect(r.deltaProjected).toBe(-5000);
  });

  it('does not mutate the input data', () => {
    const before = JSON.stringify(data);
    runWhatIf(data, TODAY, 30, scenario({ lateDays: 15, newStudentCount: 1, extraMonthlyExpense: 5000 }));
    expect(JSON.stringify(data)).toBe(before);
  });
});

import { addDays } from './dates';
import { recurringDates, forecastCash, type Extras, type ForecastHorizon, type ForecastResult } from './forecast';
import { deriveInvoiceStatus } from './invoiceStatus';
import type { AppData, Invoice } from './types';

export interface WhatIfScenario {
  /** Days the late student's unpaid invoices slip past their due date. */
  lateDays: number;
  /** Student who pays late. Defaults to the largest outstanding (non-Draft) balance. */
  lateStudentId?: string;
  /** Number of new students joining. */
  newStudentCount: number;
  /** Monthly fee per new student, in rupees. Collected at expectedCollectionRate. */
  newStudentMonthlyFee: number;
  /** Days from today until the new students start paying. */
  newStudentStartDelayDays: number;
  /** Extra monthly expense starting today, in rupees. */
  extraMonthlyExpense: number;
}

export const DEFAULT_SCENARIO: WhatIfScenario = {
  lateDays: 15,
  newStudentCount: 0,
  newStudentMonthlyFee: 2000,
  newStudentStartDelayDays: 14,
  extraMonthlyExpense: 0,
};

export interface WhatIfResult {
  baseline: ForecastResult;
  simulated: ForecastResult;
  /** simulated.projectedBalance - baseline.projectedBalance. */
  deltaProjected: number;
  /** simulated.minimumBalance - baseline.minimumBalance. */
  deltaMinimum: number;
  /** The student whose invoices were shifted, if any. */
  lateStudentId?: string;
}

/** Student with the largest outstanding balance on non-Draft, non-Paid invoices. */
function largestDebtor(data: AppData, today: string): string | undefined {
  const totals = new Map<string, number>();
  for (const inv of data.invoices) {
    if (inv.status === 'Draft') continue;
    if (deriveInvoiceStatus(inv, today) === 'Paid') continue;
    const owed = inv.amount - inv.paidAmount;
    if (owed <= 0) continue;
    totals.set(inv.studentId, (totals.get(inv.studentId) ?? 0) + owed);
  }
  let best: string | undefined;
  let bestAmount = 0;
  for (const [studentId, amount] of totals) {
    if (amount > bestAmount) {
      best = studentId;
      bestAmount = amount;
    }
  }
  return best;
}

/**
 * Compares the baseline forecast with a scenario. The input data is not mutated.
 * Late payment: the late student's unpaid non-Draft invoices move later by lateDays.
 * New students: newStudentCount monthly collections of fee * expectedCollectionRate per month,
 * starting after newStudentStartDelayDays. Extra expense: monthly outflows starting today.
 */
export function runWhatIf(
  data: AppData,
  today: string,
  horizonDays: ForecastHorizon,
  scenario: WhatIfScenario,
): WhatIfResult {
  const lateStudentId = scenario.lateStudentId ?? largestDebtor(data, today);
  const baseline = forecastCash(data, today, horizonDays);

  const invoices: Invoice[] = data.invoices.map((inv) => {
    if (lateStudentId === undefined || inv.studentId !== lateStudentId) return inv;
    if (inv.status === 'Draft' || deriveInvoiceStatus(inv, today) === 'Paid') return inv;
    return { ...inv, dueDate: addDays(inv.dueDate, scenario.lateDays) };
  });

  const limit = addDays(today, horizonDays);
  const extraInflows: NonNullable<Extras['extraInflows']> = [];
  const extraOutflows: NonNullable<Extras['extraOutflows']> = [];

  if (scenario.newStudentCount > 0 && scenario.newStudentMonthlyFee > 0) {
    const perMonth =
      scenario.newStudentCount * scenario.newStudentMonthlyFee * data.assumptions.expectedCollectionRate;
    const start = addDays(today, scenario.newStudentStartDelayDays);
    for (const date of recurringDates(start, 1, limit)) {
      extraInflows.push({ date, amount: perMonth });
    }
  }

  if (scenario.extraMonthlyExpense > 0) {
    for (const date of recurringDates(today, 1, limit)) {
      extraOutflows.push({ date, amount: scenario.extraMonthlyExpense });
    }
  }

  const simulated = forecastCash({ ...data, invoices }, today, horizonDays, {
    extras: { extraInflows, extraOutflows },
  });

  return {
    baseline,
    simulated,
    deltaProjected: simulated.projectedBalance - baseline.projectedBalance,
    deltaMinimum: simulated.minimumBalance - baseline.minimumBalance,
    lateStudentId,
  };
}

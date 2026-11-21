import { addDays } from './dates';
import { deriveInvoiceStatus } from './invoiceStatus';
import type { Bill, BillFrequency, CashSnapshot, ForecastAssumptions, Invoice } from './types';

export type ForecastHorizon = 30 | 60 | 90;

/** The subset of AppData the forecast reads. AppData satisfies it structurally. */
export interface ForecastInput {
  invoices: Invoice[];
  bills: Bill[];
  cash: CashSnapshot;
  assumptions: ForecastAssumptions;
}

export interface ForecastResult {
  horizonDays: ForecastHorizon;
  /** cashBalance + expectedCollections - upcomingBills, in rupees. */
  projectedBalance: number;
  /** Weighted (by expectedCollectionRate) outstanding on non-Draft invoices due within the horizon, plus extra inflows. */
  expectedCollections: number;
  /** Bill occurrences due within the horizon, plus extra outflows. */
  upcomingBills: number;
  /** Lowest balance on the daily curve from day 0 to the horizon end, in rupees. */
  minimumBalance: number;
}

/** Dated events injected by scenarios (e.g. the what-if simulator). Counted fully when within the window. */
export interface Extras {
  extraInflows?: { date: string; amount: number }[];
  extraOutflows?: { date: string; amount: number }[];
}

export interface ForecastOptions {
  /** Count Draft invoices in expected collections. Default false. */
  includeDrafts?: boolean;
  extras?: Extras;
}

export interface CashCurvePoint {
  /** ISO yyyy-mm-dd. */
  date: string;
  /** Days from today. */
  day: number;
  /** Projected cash at the end of this day, in rupees. */
  balance: number;
  inflow: number;
  outflow: number;
}

interface CashEvent {
  /** ISO yyyy-mm-dd, never earlier than today. */
  date: string;
  amount: number;
  kind: 'collection' | 'bill';
}

const MONTHS_PER_CYCLE: Record<Exclude<BillFrequency, 'one_time'>, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Dates start + k * stepMonths for k = 0, 1, ... up to and including `limit`.
 * The day of month stays anchored to the start date's day, clamped to the end of shorter months.
 */
export function recurringDates(start: string, stepMonths: number, limit: string): string[] {
  const [y, m, d] = start.split('-').map(Number);
  const out: string[] = [];
  for (let k = 0; ; k++) {
    const total = y * 12 + (m - 1) + k * stepMonths;
    const year = Math.floor(total / 12);
    const month = (total % 12) + 1;
    const lastDay = new Date(year, month, 0).getDate();
    const iso = `${year}-${pad2(month)}-${pad2(Math.min(d, lastDay))}`;
    if (iso > limit) break;
    out.push(iso);
  }
  return out;
}

const laterOf = (a: string, b: string): string => (a > b ? a : b);

/**
 * The single event list used by forecastCash and cashCurve.
 * Only events dated within [today, today + horizonDays] are returned.
 */
function buildEvents(data: ForecastInput, today: string, horizonDays: number, options: ForecastOptions): CashEvent[] {
  const limit = addDays(today, horizonDays);
  const rate = data.assumptions.expectedCollectionRate;
  const events: CashEvent[] = [];

  for (const inv of data.invoices) {
    if (inv.status === 'Draft' && options.includeDrafts !== true) continue;
    if (deriveInvoiceStatus(inv, today) === 'Paid') continue;
    const outstanding = Math.max(0, inv.amount - inv.paidAmount);
    if (outstanding <= 0) continue;
    if (inv.dueDate > limit) continue;
    events.push({ date: laterOf(inv.dueDate, today), amount: outstanding * rate, kind: 'collection' });
  }

  for (const bill of data.bills) {
    if (bill.frequency === 'one_time') {
      // A paid one-time bill has no outflow. An unpaid one falls on its due date, or today if already past due.
      if (bill.paidForCycle) continue;
      const date = laterOf(bill.nextDueDate, today);
      if (date <= limit) events.push({ date, amount: bill.amount, kind: 'bill' });
      continue;
    }

    const occurrences = recurringDates(bill.nextDueDate, MONTHS_PER_CYCLE[bill.frequency], limit);
    if (bill.paidForCycle) {
      // The cycle at nextDueDate is treated as paid and skipped for every frequency.
      // Count the scheduled occurrences after it that fall on or after today.
      for (const date of occurrences.slice(1)) {
        if (date >= today) events.push({ date, amount: bill.amount, kind: 'bill' });
      }
      continue;
    }

    // An unpaid cycle already past due is one outflow on today. Earlier missed cycles are not counted.
    if (bill.nextDueDate < today) events.push({ date: today, amount: bill.amount, kind: 'bill' });
    for (const date of occurrences) {
      if (date >= today) events.push({ date, amount: bill.amount, kind: 'bill' });
    }
  }

  for (const e of options.extras?.extraInflows ?? []) {
    if (e.date <= limit) events.push({ date: laterOf(e.date, today), amount: e.amount, kind: 'collection' });
  }
  for (const e of options.extras?.extraOutflows ?? []) {
    if (e.date <= limit) events.push({ date: laterOf(e.date, today), amount: e.amount, kind: 'bill' });
  }

  return events;
}

/** Daily balances from day 0 (today) to day horizonDays, applying the events on each day. */
function curveFrom(cash: CashSnapshot, today: string, horizonDays: number, events: CashEvent[]): CashCurvePoint[] {
  const points: CashCurvePoint[] = [];
  let balance = cash.balance;
  for (let day = 0; day <= horizonDays; day++) {
    const date = addDays(today, day);
    let inflow = 0;
    let outflow = 0;
    for (const ev of events) {
      if (ev.date !== date) continue;
      if (ev.kind === 'collection') inflow += ev.amount;
      else outflow += ev.amount;
    }
    balance = balance + inflow - outflow;
    points.push({ date, day, balance, inflow, outflow });
  }
  return points;
}

/**
 * Projected cash over the horizon:
 *   projectedBalance = cash.balance + expectedCollections - upcomingBills
 * expectedCollections covers non-Draft invoices (unless includeDrafts) with outstanding balance
 * due by today + horizon, weighted by expectedCollectionRate. Items already past due are placed on today.
 * Recurring bills produce one occurrence per cycle, anchored to nextDueDate's day of month.
 * An unpaid bill past due contributes one outflow on today (its overdue cycle); earlier missed cycles are not stacked.
 * A paid bill skips its current cycle for every frequency.
 */
export function forecastCash(
  data: ForecastInput,
  today: string,
  horizonDays: ForecastHorizon,
  options: ForecastOptions = {},
): ForecastResult {
  const events = buildEvents(data, today, horizonDays, options);

  let expectedCollections = 0;
  let upcomingBills = 0;
  for (const ev of events) {
    if (ev.kind === 'collection') expectedCollections += ev.amount;
    else upcomingBills += ev.amount;
  }

  const projectedBalance = data.cash.balance + expectedCollections - upcomingBills;
  const curve = curveFrom(data.cash, today, horizonDays, events);
  // The horizon-end point of the curve equals projectedBalance. Including it explicitly means
  // floating-point rounding in the running sum cannot push the minimum above the projection.
  const minimumBalance = Math.min(projectedBalance, ...curve.map((p) => p.balance));

  return {
    horizonDays,
    projectedBalance,
    expectedCollections,
    upcomingBills,
    minimumBalance,
  };
}

/** One point per day from today (day 0) to today + horizonDays, using the same events as forecastCash. */
export function cashCurve(
  data: ForecastInput,
  today: string,
  horizonDays: number,
  extras?: Extras,
): CashCurvePoint[] {
  const events = buildEvents(data, today, horizonDays, { extras });
  return curveFrom(data.cash, today, horizonDays, events);
}

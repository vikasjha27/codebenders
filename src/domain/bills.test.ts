import { describe, it, expect } from 'vitest';
import { summarisePendingBills } from './bills';
import { cashCurve, forecastCash } from './forecast';
import type { Bill, ForecastAssumptions } from './types';

const assumptions: ForecastAssumptions = { expectedCollectionRate: 0.5, defaultPaymentDelayDays: 7 };
const cash = { balance: 0, asOfDate: '2025-04-01' };
const TODAY = '2025-04-01'; // 30-day limit 2025-05-01, 90-day limit 2025-06-30

const bill = (over: Partial<Bill> & Pick<Bill, 'id' | 'frequency' | 'nextDueDate' | 'amount'>): Bill => ({
  name: over.id,
  category: 'Other',
  paidForCycle: false,
  ...over,
});

const forecast = (bills: Bill[], horizon: 30 | 60 | 90) =>
  forecastCash({ invoices: [], bills, cash, assumptions }, TODAY, horizon);

describe('summarisePendingBills', () => {
  const today = '2025-04-15';
  const bills: Bill[] = [
    bill({ id: 'A', frequency: 'monthly', nextDueDate: '2025-04-05', amount: 1000 }), // this month, overdue
    bill({ id: 'B', frequency: 'monthly', nextDueDate: '2025-04-30', amount: 2000 }), // this month, upcoming
    bill({ id: 'G', frequency: 'one_time', nextDueDate: '2025-04-20', amount: 0.1 }), // this month
    bill({ id: 'H', frequency: 'one_time', nextDueDate: '2025-04-21', amount: 0.2 }), // this month
    bill({ id: 'C', frequency: 'quarterly', nextDueDate: '2025-03-28', amount: 3000 }), // carried over
    bill({ id: 'F', frequency: 'yearly', nextDueDate: '2025-02-10', amount: 250.5 }), // carried over
    bill({ id: 'I', frequency: 'monthly', nextDueDate: '2025-03-31', amount: 700 }), // last day of previous month: carried over
    bill({ id: 'D', frequency: 'monthly', nextDueDate: '2025-04-10', amount: 500, paidForCycle: true }), // paid: excluded
    bill({ id: 'E', frequency: 'monthly', nextDueDate: '2025-05-02', amount: 4000 }), // later month: all unpaid only
  ];

  it('splits unpaid bills into this month, carried over and all unpaid', () => {
    const s = summarisePendingBills(bills, today);
    expect(s.thisMonthTotal).toBe(3000.3);
    expect(s.thisMonthCount).toBe(4);
    expect(s.carriedOverTotal).toBe(3950.5);
    expect(s.carriedOverCount).toBe(3);
    expect(s.allUnpaidTotal).toBe(10950.8);
    expect(s.allUnpaidCount).toBe(8);
  });

  it('keeps this-month and carried-over buckets disjoint', () => {
    const s = summarisePendingBills(bills, today);
    expect(s.thisMonthCount + s.carriedOverCount).toBeLessThanOrEqual(s.allUnpaidCount);
    expect(s.thisMonthTotal + s.carriedOverTotal).toBeLessThanOrEqual(s.allUnpaidTotal);
  });

  it('returns zeros for an empty list', () => {
    expect(summarisePendingBills([], today)).toEqual({
      thisMonthTotal: 0,
      thisMonthCount: 0,
      carriedOverTotal: 0,
      carriedOverCount: 0,
      allUnpaidTotal: 0,
      allUnpaidCount: 0,
    });
  });
});

describe('forecastCash bill catch-up and paid cycles', () => {
  it('counts a stale unpaid monthly bill once on today, not once per missed cycle', () => {
    // Missed cycles 01-15, 02-15, 03-15 are not stacked. Overdue cycle goes on today; 04-15 is the next scheduled one.
    const stale = [bill({ id: 'R', frequency: 'monthly', nextDueDate: '2025-01-15', amount: 5000 })];
    const result = forecast(stale, 30);
    expect(result.upcomingBills).toBe(10000);
    const curve = cashCurve({ invoices: [], bills: stale, cash, assumptions }, TODAY, 30);
    expect(curve[0].outflow).toBe(5000); // overdue cycle on today
    expect(curve[14]).toMatchObject({ date: '2025-04-15', outflow: 5000 });
  });

  it('skips the current cycle of a paid quarterly bill and counts the next one', () => {
    const paid = [bill({ id: 'Q', frequency: 'quarterly', nextDueDate: '2025-04-10', amount: 6000, paidForCycle: true })];
    // Current cycle 04-10 skipped; next is 07-10, outside the 90-day window (to 06-30).
    expect(forecast(paid, 90).upcomingBills).toBe(0);
  });

  it('counts an unpaid quarterly bill on its nextDueDate', () => {
    const unpaid = [bill({ id: 'Q', frequency: 'quarterly', nextDueDate: '2025-04-10', amount: 6000 })];
    expect(forecast(unpaid, 90).upcomingBills).toBe(6000);
  });

  it('treats a paid stale quarterly bill as skipped for its overdue cycle only', () => {
    // Cycles 01-10 (paid, skipped) and 04-10 (next scheduled, counted); 07-10 is outside the window.
    const paid = [bill({ id: 'Q', frequency: 'quarterly', nextDueDate: '2025-01-10', amount: 6000, paidForCycle: true })];
    expect(forecast(paid, 90).upcomingBills).toBe(6000);
  });

  it('counts an unpaid yearly bill on its nextDueDate', () => {
    const yearly = [bill({ id: 'Y', frequency: 'yearly', nextDueDate: '2025-04-20', amount: 12000 })];
    expect(forecast(yearly, 30).upcomingBills).toBe(12000);
    const curve = cashCurve({ invoices: [], bills: yearly, cash, assumptions }, TODAY, 30);
    expect(curve[19]).toMatchObject({ date: '2025-04-20', outflow: 12000 });
  });

  it('places an unpaid one-time bill past due on today, and omits a paid one', () => {
    const overdue = [bill({ id: 'O', frequency: 'one_time', nextDueDate: '2025-03-20', amount: 800 })];
    expect(forecast(overdue, 30).upcomingBills).toBe(800);
    expect(cashCurve({ invoices: [], bills: overdue, cash, assumptions }, TODAY, 30)[0].outflow).toBe(800);

    const paid = [bill({ id: 'O', frequency: 'one_time', nextDueDate: '2025-03-20', amount: 800, paidForCycle: true })];
    expect(forecast(paid, 90).upcomingBills).toBe(0);
  });
});

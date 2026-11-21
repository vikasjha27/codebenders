import type { Bill } from './types';

export interface PendingBillsSummary {
  /** Unpaid bills whose nextDueDate is in the same calendar month as today (includes overdue ones from this month). */
  thisMonthTotal: number;
  thisMonthCount: number;
  /** Unpaid bills whose nextDueDate is before the first day of today's month (still owed from earlier months). */
  carriedOverTotal: number;
  carriedOverCount: number;
  /** All unpaid bills, including ones due in later months. */
  allUnpaidTotal: number;
  allUnpaidCount: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Summarises unpaid bills (paidForCycle false) relative to `today` (ISO yyyy-mm-dd).
 * thisMonth and carriedOver are disjoint; allUnpaid covers every unpaid bill. Sums are rounded to 2 dp.
 */
export function summarisePendingBills(bills: Bill[], today: string): PendingBillsSummary {
  const yearMonth = today.slice(0, 7); // "yyyy-mm"
  const monthStart = `${yearMonth}-01`;

  let thisMonthTotal = 0;
  let thisMonthCount = 0;
  let carriedOverTotal = 0;
  let carriedOverCount = 0;
  let allUnpaidTotal = 0;
  let allUnpaidCount = 0;

  for (const bill of bills) {
    if (bill.paidForCycle) continue;
    allUnpaidTotal += bill.amount;
    allUnpaidCount += 1;
    if (bill.nextDueDate.slice(0, 7) === yearMonth) {
      thisMonthTotal += bill.amount;
      thisMonthCount += 1;
    } else if (bill.nextDueDate < monthStart) {
      carriedOverTotal += bill.amount;
      carriedOverCount += 1;
    }
  }

  return {
    thisMonthTotal: round2(thisMonthTotal),
    thisMonthCount,
    carriedOverTotal: round2(carriedOverTotal),
    carriedOverCount,
    allUnpaidTotal: round2(allUnpaidTotal),
    allUnpaidCount,
  };
}

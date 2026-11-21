import { toISODate } from './dates';

/** Today's date in local time as ISO yyyy-mm-dd. Pass `now` in tests. */
export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

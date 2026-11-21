/**
 * Date helpers. Dates are ISO "yyyy-mm-dd" strings at the boundary and local
 * Date objects internally, so no timezone shift occurs. Functions that depend
 * on "now" take an explicit `today` argument instead of reading the clock.
 */

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Parses "yyyy-mm-dd" as a local-midnight Date (no UTC shift). */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Formats a Date as local "yyyy-mm-dd". */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "2025-04-05" -> "05/04/2025". */
export function formatDMY(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Date -> "Apr 2025" (en-IN, month short + year). */
export function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

/** Adds n calendar days to an ISO date (n may be negative). Handles month and year ends. */
export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

const MS_PER_DAY = 86_400_000;

function utcMidnightMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole calendar days from `fromIso` to `toIso` (negative if `toIso` is earlier). DST-safe. */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((utcMidnightMs(toIso) - utcMidnightMs(fromIso)) / MS_PER_DAY);
}

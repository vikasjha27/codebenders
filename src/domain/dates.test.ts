import { describe, it, expect } from 'vitest';
import { addDays, daysBetween, formatDMY, parseISODate, toISODate } from './dates';

describe('formatDMY', () => {
  it('formats ISO as DD/MM/YYYY', () => {
    expect(formatDMY('2025-04-05')).toBe('05/04/2025');
  });
});

describe('addDays', () => {
  it('crosses month end', () => {
    expect(addDays('2025-01-31', 1)).toBe('2025-02-01');
    expect(addDays('2025-04-28', 5)).toBe('2025-05-03');
  });

  it('handles leap day and negative offsets', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-03-01', -1)).toBe('2025-02-28');
  });
});

describe('daysBetween', () => {
  it('counts calendar days', () => {
    expect(daysBetween('2025-04-01', '2025-04-05')).toBe(4);
    expect(daysBetween('2025-04-05', '2025-04-01')).toBe(-4);
  });
});

describe('parseISODate / toISODate', () => {
  it('round-trips without timezone shift', () => {
    expect(toISODate(parseISODate('2025-04-05'))).toBe('2025-04-05');
  });
});

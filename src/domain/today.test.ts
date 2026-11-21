import { describe, it, expect } from 'vitest';
import { todayISO } from './today';

describe('todayISO', () => {
  it('formats a local date as yyyy-mm-dd', () => {
    expect(todayISO(new Date(2025, 3, 5))).toBe('2025-04-05');
  });
});

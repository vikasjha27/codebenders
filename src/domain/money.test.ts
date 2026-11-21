import { describe, it, expect } from 'vitest';
import { formatINR } from './money';

describe('formatINR', () => {
  it('formats with Indian digit grouping', () => {
    const out = formatINR(125000).replace(/[\u00a0\u202f]/g, ' ');
    expect(out).toContain('₹1,25,000');
  });
});

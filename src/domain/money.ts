const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** Formats rupees with Indian digit grouping, e.g. 125000 -> "₹1,25,000". */
export function formatINR(amount: number): string {
  return inrFormatter.format(amount);
}

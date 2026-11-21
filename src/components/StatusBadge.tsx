import type { InvoiceStatus } from '../domain/types';

const CLASS_BY_STATUS: Record<InvoiceStatus, string> = {
  Paid: 'badge badge-paid',
  'Partially Paid': 'badge badge-partial',
  Sent: 'badge badge-sent',
  Draft: 'badge badge-draft',
  Overdue: 'badge badge-overdue',
};

/** Colour-coded invoice status pill. */
export function StatusBadge({ status }: { status: InvoiceStatus }): JSX.Element {
  return <span className={CLASS_BY_STATUS[status]}>{status}</span>;
}

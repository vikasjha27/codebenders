import { Spinner } from '../../components/Spinner';
import { summarisePendingBills } from '../../domain/bills';
import { formatDMY, formatMonthLabel } from '../../domain/dates';
import { formatINR } from '../../domain/money';
import type { BillFrequency } from '../../domain/types';
import { todayISO } from '../../domain/today';
import { useAppData } from '../../storage/AppDataProvider';

const FREQUENCY_LABEL: Record<BillFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  one_time: 'One-time',
};

export function ExpensesPage(): JSX.Element {
  const { status, data } = useAppData();
  if (status === 'loading') return <Spinner />;

  const now = new Date();
  const today = todayISO();
  const pending = summarisePendingBills(data.bills, today);

  return (
    <section>
      <h1>Expenses</h1>
      <h2 className="month-label">{formatMonthLabel(now)}</h2>
      <p className="summary">
        Pending this month: <strong>{formatINR(pending.thisMonthTotal)}</strong> ({pending.thisMonthCount}{' '}
        {pending.thisMonthCount === 1 ? 'bill' : 'bills'})
      </p>
      <p className="muted">
        Carried over from earlier months: {formatINR(pending.carriedOverTotal)} ({pending.carriedOverCount}{' '}
        {pending.carriedOverCount === 1 ? 'bill' : 'bills'})
      </p>
      <p className="muted">All unpaid: {formatINR(pending.allUnpaidTotal)}</p>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Bill</th>
              <th>Category</th>
              <th>Frequency</th>
              <th className="num">Amount</th>
              <th>Next due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.bills.map((b) => (
              <tr key={b.id}>
                <td>
                  {b.name}
                  {b.tutorName && <div className="muted small">{b.tutorName}</div>}
                </td>
                <td>{b.category}</td>
                <td>{FREQUENCY_LABEL[b.frequency]}</td>
                <td className="num">{formatINR(b.amount)}</td>
                <td>{formatDMY(b.nextDueDate)}</td>
                <td>
                  <span className={b.paidForCycle ? 'badge badge-paid' : 'badge badge-sent'}>
                    {b.paidForCycle ? 'Paid this cycle' : 'Pending'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

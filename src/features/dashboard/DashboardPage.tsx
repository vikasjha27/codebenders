import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from '../../components/Spinner';
import { buildAlerts } from '../../domain/alerts';
import { addDays, formatDMY } from '../../domain/dates';
import { forecastCash, type ForecastHorizon, type ForecastResult } from '../../domain/forecast';
import { deriveInvoiceStatus, isDueSoon } from '../../domain/invoiceStatus';
import { formatINR } from '../../domain/money';
import { outstandingOf } from '../../domain/payments';
import { buildReceivables, type ReceivableAging } from '../../domain/receivables';
import type { Bill, Invoice, ReminderLog } from '../../domain/types';
import { todayISO } from '../../domain/today';
import { DEFAULT_SCENARIO, runWhatIf, type WhatIfScenario } from '../../domain/whatIf';
import { useAppData } from '../../storage/AppDataProvider';
import { ReminderPanel } from '../invoices/ReminderPanel';

const HORIZONS: ForecastHorizon[] = [30, 60, 90];
const ALERT_LIMIT = 5;
const MAX_LATE_DAYS = 90;

const AGING_ROWS: { key: keyof ReceivableAging; label: string }[] = [
  { key: 'dueSoon', label: 'Due soon' },
  { key: 'days1to7', label: '1–7 days overdue' },
  { key: 'days8to15', label: '8–15 days overdue' },
  { key: 'days16to30', label: '16–30 days overdue' },
  { key: 'days31plus', label: '31+ days overdue' },
];

type ForecastMetric = 'projectedBalance' | 'minimumBalance' | 'expectedCollections' | 'upcomingBills';

const WHAT_IF_ROWS: { key: ForecastMetric; label: string }[] = [
  { key: 'projectedBalance', label: 'Projected balance' },
  { key: 'minimumBalance', label: 'Minimum balance over window' },
  { key: 'expectedCollections', label: 'Expected collections' },
  { key: 'upcomingBills', label: 'Upcoming bills' },
];

/** What-if form values. Number fields stay as text so the user can clear them while typing. */
interface WhatIfInputs {
  horizon: ForecastHorizon;
  lateDays: string;
  /** '' means automatic: the largest outstanding balance. */
  lateStudentId: string;
  newStudentJoins: boolean;
  newStudentFee: string;
  newStudentDelay: string;
  extraExpense: string;
}

const INITIAL_WHAT_IF: WhatIfInputs = {
  horizon: 30,
  lateDays: String(DEFAULT_SCENARIO.lateDays),
  lateStudentId: '',
  newStudentJoins: false,
  newStudentFee: String(DEFAULT_SCENARIO.newStudentMonthlyFee),
  newStudentDelay: String(DEFAULT_SCENARIO.newStudentStartDelayDays),
  extraExpense: String(DEFAULT_SCENARIO.extraMonthlyExpense),
};

/** Empty or NaN counts as 0. Result is at least `min`, and at most `max` when given. */
function numberOr0(text: string, min: number, max = Infinity): number {
  const n = Number(text);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, n));
}

function parseHorizon(value: string): ForecastHorizon {
  if (value === '60') return 60;
  if (value === '90') return 90;
  return 30;
}

function scenarioFrom(inputs: WhatIfInputs): WhatIfScenario {
  return {
    lateDays: Math.round(numberOr0(inputs.lateDays, 0, MAX_LATE_DAYS)),
    lateStudentId: inputs.lateStudentId === '' ? undefined : inputs.lateStudentId,
    newStudentCount: inputs.newStudentJoins ? 1 : 0,
    newStudentMonthlyFee: numberOr0(inputs.newStudentFee, 0),
    newStudentStartDelayDays: Math.round(numberOr0(inputs.newStudentDelay, 0)),
    extraMonthlyExpense: numberOr0(inputs.extraExpense, 0),
  };
}

export function DashboardPage(): JSX.Element {
  const { status, data, update } = useAppData();
  const today = todayISO();
  const receivables = useMemo(() => buildReceivables(data, today), [data, today]);
  const alerts = useMemo(() => buildAlerts(data, today), [data, today]);
  const [reminderInvoiceId, setReminderInvoiceId] = useState<string | null>(null);
  const [whatIf, setWhatIf] = useState<WhatIfInputs>(INITIAL_WHAT_IF);
  const whatIfResult = useMemo(
    () => runWhatIf(data, today, whatIf.horizon, scenarioFrom(whatIf)),
    [data, today, whatIf],
  );
  if (status === 'loading') return <Spinner />;

  function patchWhatIf(patch: Partial<WhatIfInputs>): void {
    setWhatIf((prev) => ({ ...prev, ...patch }));
  }

  // Same definition as the "Who owes me" totals, so the two sections cannot disagree.
  const { aging } = receivables;
  const overdueCount =
    aging.days1to7.count + aging.days8to15.count + aging.days16to30.count + aging.days31plus.count;

  const dueSoon = data.invoices.filter((inv) => isDueSoon(inv, today, 3));
  const dueSoonTotal = dueSoon.reduce((sum, inv) => sum + outstandingOf(inv), 0);

  const billsDueWeek: Bill[] = data.bills
    .filter((b) => !b.paidForCycle && b.nextDueDate <= addDays(today, 7))
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
  const billsDueWeekTotal = billsDueWeek.reduce((sum, b) => sum + b.amount, 0);

  const topAlerts = alerts.slice(0, ALERT_LIMIT);

  const reminderInvoice = reminderInvoiceId
    ? data.invoices.find((i) => i.id === reminderInvoiceId)
    : undefined;
  const reminderStudent = reminderInvoice
    ? data.students.find((s) => s.id === reminderInvoice.studentId)
    : undefined;

  const studentName = (id: string): string | undefined => data.students.find((s) => s.id === id)?.studentName;

  /** The student's oldest invoice that is still owed: not Draft, not Paid, earliest due date. */
  function oldestPayableInvoiceId(studentId: string): string | undefined {
    return data.invoices
      .filter((inv) => {
        if (inv.studentId !== studentId) return false;
        const derived = deriveInvoiceStatus(inv, today);
        return derived !== 'Draft' && derived !== 'Paid' && outstandingOf(inv) > 0;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]?.id;
  }

  function markReminderSent(invoice: Invoice, log: ReminderLog): void {
    update({
      ...data,
      invoices: data.invoices.map((i) =>
        i.id === invoice.id ? { ...i, reminders: [...(i.reminders ?? []), log] } : i,
      ),
    });
  }

  return (
    <section>
      <h1>Dashboard</h1>

      <div className="card-grid">
        <div className="card">
          <h2 className="card-title">Cash balance</h2>
          <p className="card-value">{formatINR(data.cash.balance)}</p>
          <p className="card-meta">As of {formatDMY(data.cash.asOfDate)}</p>
        </div>

        <div className="card">
          <h2 className="card-title">Overdue invoices</h2>
          <p className="card-value text-red">{overdueCount}</p>
          <p className="card-meta">{formatINR(receivables.totalOverdue)} outstanding</p>
        </div>

        <div className="card">
          <h2 className="card-title">Due in next 3 days</h2>
          <p className="card-value">{dueSoon.length}</p>
          <p className="card-meta">{formatINR(dueSoonTotal)} expected</p>
        </div>

        <div className="card">
          <h2 className="card-title">Bills due in 7 days</h2>
          <p className="card-value">{billsDueWeek.length}</p>
          <p className="card-meta">{formatINR(billsDueWeekTotal)} to pay</p>
          {billsDueWeek.length > 0 && (
            <ul className="card-list">
              {billsDueWeek.map((b) => (
                <li key={b.id}>
                  {b.name} · {formatDMY(b.nextDueDate)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <h2>Chase this today</h2>
      {topAlerts.length === 0 ? (
        <p className="muted">No urgent actions today.</p>
      ) : (
        <ul className="alert-list">
          {topAlerts.map((a) => (
            <li key={a.id}>
              <span className={`badge badge-${a.severity}`}>{a.severity}</span>
              <div>
                <strong>{a.title}</strong>
                <p className="muted small">{a.detail}</p>
              </div>
              <div className="form-actions">
                {a.action === 'record_payment' && a.invoiceId !== undefined && (
                  <Link className="btn btn-small" to={`/invoices?invoice=${encodeURIComponent(a.invoiceId)}`}>
                    Record payment
                  </Link>
                )}
                {a.action === 'reminder' && a.invoiceId !== undefined && (
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => setReminderInvoiceId(a.invoiceId ?? null)}
                  >
                    Open reminder
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2>Cash forecast</h2>
      <div className="card-grid">
        {HORIZONS.map((h) => {
          const f = forecastCash(data, today, h);
          return (
            <div className="card" key={h}>
              <h3 className="card-title">Next {h} days</h3>
              <p className="card-value">{formatINR(f.projectedBalance)}</p>
              <p className="card-meta">
                + {formatINR(f.expectedCollections)} expected · − {formatINR(f.upcomingBills)} bills
              </p>
              <p className="card-meta">Lowest balance {formatINR(f.minimumBalance)}</p>
            </div>
          );
        })}
      </div>

      <h2>What-if simulator</h2>
      <div className="card">
        <div className="whatif-inputs">
          <div className="field">
            <label htmlFor="wi-horizon">Horizon</label>
            <select
              id="wi-horizon"
              value={whatIf.horizon}
              onChange={(e) => patchWhatIf({ horizon: parseHorizon(e.target.value) })}
            >
              {HORIZONS.map((h) => (
                <option key={h} value={h}>
                  {h} days
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="wi-late-days">Client pays late by (days)</label>
            <input
              id="wi-late-days"
              type="number"
              min={0}
              max={MAX_LATE_DAYS}
              step={1}
              value={whatIf.lateDays}
              onChange={(e) => patchWhatIf({ lateDays: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="wi-late-client">Late client</label>
            <select
              id="wi-late-client"
              value={whatIf.lateStudentId}
              onChange={(e) => patchWhatIf({ lateStudentId: e.target.value })}
            >
              <option value="">Auto: largest balance</option>
              {receivables.byStudent.map((r) => (
                <option key={r.studentId} value={r.studentId}>
                  {r.studentName}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="wi-extra">Extra monthly expense (₹)</label>
            <input
              id="wi-extra"
              type="number"
              min={0}
              step="any"
              value={whatIf.extraExpense}
              onChange={(e) => patchWhatIf({ extraExpense: e.target.value })}
            />
          </div>
        </div>

        <div className="field">
          <input
            id="wi-new-student"
            type="checkbox"
            checked={whatIf.newStudentJoins}
            onChange={(e) => patchWhatIf({ newStudentJoins: e.target.checked })}
          />{' '}
          <label htmlFor="wi-new-student">New student joins</label>
        </div>

        {whatIf.newStudentJoins && (
          <div className="whatif-inputs">
            <div className="field">
              <label htmlFor="wi-new-fee">New student monthly fee (₹)</label>
              <input
                id="wi-new-fee"
                type="number"
                min={0}
                step="any"
                value={whatIf.newStudentFee}
                onChange={(e) => patchWhatIf({ newStudentFee: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="wi-new-delay">New student starts in (days)</label>
              <input
                id="wi-new-delay"
                type="number"
                min={0}
                step={1}
                value={whatIf.newStudentDelay}
                onChange={(e) => patchWhatIf({ newStudentDelay: e.target.value })}
              />
            </div>
          </div>
        )}

        {whatIfResult.lateStudentId !== undefined && (
          <p className="summary">Late client: {studentName(whatIfResult.lateStudentId) ?? 'Unknown student'}</p>
        )}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Measure</th>
                <th className="num">Baseline</th>
                <th className="num">Simulated</th>
                <th className="num">Change</th>
              </tr>
            </thead>
            <tbody>
              {WHAT_IF_ROWS.map((row) => {
                const base: ForecastResult = whatIfResult.baseline;
                const sim: ForecastResult = whatIfResult.simulated;
                return (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td className="num">{formatINR(base[row.key])}</td>
                    <td className="num">{formatINR(sim[row.key])}</td>
                    <td className="num">{formatINR(sim[row.key] - base[row.key])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Over the next {whatIf.horizon} days. Drafts are excluded from expected collections.
        </p>
      </div>

      <h2>Who owes me</h2>
      <div className="card-grid">
        <div className="card">
          <h3 className="card-title">Total outstanding</h3>
          <p className="card-value">{formatINR(receivables.totalOutstanding)}</p>
        </div>
        <div className="card">
          <h3 className="card-title">Overdue</h3>
          <p className="card-value text-red">{formatINR(receivables.totalOverdue)}</p>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Ageing</th>
              <th className="num">Amount</th>
              <th className="num">Invoices</th>
            </tr>
          </thead>
          <tbody>
            {AGING_ROWS.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td className="num">{formatINR(aging[row.key].amount)}</td>
                <td className="num">{aging[row.key].count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {receivables.byStudent.length === 0 ? (
        <p className="muted">Nobody owes you right now.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Parent</th>
                <th className="num">Owes</th>
                <th>Since</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {receivables.byStudent.map((r) => {
                const payId = oldestPayableInvoiceId(r.studentId);
                const since =
                  r.oldestDueDate === undefined
                    ? '—'
                    : r.daysOverdue > 0
                      ? `${formatDMY(r.oldestDueDate)} · ${r.daysOverdue} days overdue`
                      : 'Not yet overdue';
                return (
                  <tr key={r.studentId}>
                    <td>{r.studentName}</td>
                    <td>{r.parentName}</td>
                    <td className="num">{formatINR(r.outstanding)}</td>
                    <td>{since}</td>
                    <td>
                      <div className="form-actions">
                        {payId !== undefined && (
                          <Link
                            className="btn btn-small"
                            to={`/invoices?student=${encodeURIComponent(r.studentId)}&invoice=${encodeURIComponent(payId)}`}
                          >
                            Record payment
                          </Link>
                        )}
                        {payId !== undefined && (
                          <button
                            type="button"
                            className="btn btn-small"
                            onClick={() => setReminderInvoiceId(payId)}
                          >
                            Reminder
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {reminderInvoice && (
        // ReminderPanel renders its own .modal-backdrop > .modal wrapper.
        <ReminderPanel
          key={reminderInvoice.id}
          invoice={reminderInvoice}
          student={reminderStudent}
          today={today}
          onMarkSent={(log) => markReminderSent(reminderInvoice, log)}
          onClose={() => setReminderInvoiceId(null)}
        />
      )}
    </section>
  );
}

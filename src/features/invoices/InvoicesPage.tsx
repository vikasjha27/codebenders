import { Fragment, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Spinner } from '../../components/Spinner';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDMY } from '../../domain/dates';
import { formatINR } from '../../domain/money';
import { deriveInvoiceStatus, isDueSoon } from '../../domain/invoiceStatus';
import { outstandingOf } from '../../domain/payments';
import type { Invoice } from '../../domain/types';
import { todayISO } from '../../domain/today';
import { useAppData } from '../../storage/AppDataProvider';
import { CreateInvoiceForm } from './CreateInvoiceForm';
import { RecordPaymentForm } from './RecordPaymentForm';
import { ReminderPanel } from './ReminderPanel';

type PanelMode = 'payment' | 'reminder';

export function InvoicesPage(): JSX.Element {
  const { status, data, update } = useAppData();
  const [searchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [panel, setPanel] = useState<{ invoiceId: string; mode: PanelMode } | null>(null);

  // "?invoice=<id>" (e.g. from the dashboard) opens that invoice's payment form. Paid invoices are not opened.
  // Keyed on the param only, so saving a payment does not re-open the form.
  const invoiceParam = searchParams.get('invoice');
  useEffect(() => {
    if (invoiceParam === null) return;
    const target = data.invoices.find((i) => i.id === invoiceParam);
    if (!target || deriveInvoiceStatus(target, todayISO()) === 'Paid') return;
    setPanel({ invoiceId: target.id, mode: 'payment' });
  }, [invoiceParam]);

  if (status === 'loading') return <Spinner />;

  const today = todayISO();
  const studentNames = new Map(data.students.map((s) => [s.id, s.studentName]));
  const studentFilter = searchParams.get('student');
  const rows = [...data.invoices]
    .filter((inv) => studentFilter === null || inv.studentId === studentFilter)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const panelInvoice = panel ? data.invoices.find((i) => i.id === panel.invoiceId) : undefined;

  function saveInvoice(next: Invoice): void {
    update({
      ...data,
      invoices: data.invoices.map((i) => (i.id === next.id ? next : i)),
    });
  }

  function togglePanel(invoiceId: string, mode: PanelMode): void {
    setPanel((prev) => (prev?.invoiceId === invoiceId && prev.mode === mode ? null : { invoiceId, mode }));
  }

  return (
    <section>
      <h1>Invoices</h1>

      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Close' : 'New invoice'}
        </button>
      </div>

      {showCreate && (
        <div className="card">
          <CreateInvoiceForm
            students={data.students}
            existingInvoices={data.invoices}
            today={today}
            onCreate={(invoice) => {
              update({ ...data, invoices: [...data.invoices, invoice] });
              setShowCreate(false);
            }}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {studentFilter !== null && (
        <p className="summary">
          Showing invoices for {studentNames.get(studentFilter) ?? 'unknown student'} ·{' '}
          <Link to="/invoices">Clear filter</Link>
        </p>
      )}

      {rows.length === 0 ? (
        <p className="muted">{studentFilter !== null ? 'No invoices for this student.' : 'No invoices yet.'}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Student</th>
                <th>Billing note</th>
                <th>Issue date</th>
                <th>Due date</th>
                <th className="num">Amount</th>
                <th className="num">Paid</th>
                <th className="num">Balance</th>
                <th>Status</th>
                <th className="num">Payments</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const derived = deriveInvoiceStatus(inv, today);
                const canReminder = derived === 'Overdue' || isDueSoon(inv, today);
                const paymentOpen = panel?.invoiceId === inv.id && panel.mode === 'payment';
                return (
                  <Fragment key={inv.id}>
                    <tr>
                      <td>{inv.invoiceNumber}</td>
                      <td>{studentNames.get(inv.studentId) ?? 'Unknown student'}</td>
                      <td>{inv.billingNote ?? ''}</td>
                      <td>{formatDMY(inv.issueDate)}</td>
                      <td>{formatDMY(inv.dueDate)}</td>
                      <td className="num">{formatINR(inv.amount)}</td>
                      <td className="num">{formatINR(inv.paidAmount)}</td>
                      <td className="num">{formatINR(outstandingOf(inv))}</td>
                      <td>
                        <StatusBadge status={derived} />
                      </td>
                      <td className="num">{(inv.payments ?? []).length}</td>
                      <td>
                        <div className="form-actions">
                          {derived !== 'Paid' && (
                            <button
                              type="button"
                              className="btn btn-small"
                              onClick={() => togglePanel(inv.id, 'payment')}
                            >
                              Record payment
                            </button>
                          )}
                          {canReminder && (
                            <button
                              type="button"
                              className="btn btn-small"
                              onClick={() => togglePanel(inv.id, 'reminder')}
                            >
                              Reminder
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {paymentOpen && (
                      <tr>
                        <td colSpan={11}>
                          <RecordPaymentForm
                            invoice={inv}
                            today={today}
                            onSave={(updated) => {
                              saveInvoice(updated);
                              setPanel(null);
                            }}
                            onCancel={() => setPanel(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {panel?.mode === 'reminder' && panelInvoice && (
        // ReminderPanel renders its own .modal-backdrop > .modal wrapper.
        <ReminderPanel
          key={panelInvoice.id}
          invoice={panelInvoice}
          student={data.students.find((s) => s.id === panelInvoice.studentId)}
          today={today}
          onMarkSent={(log) => {
            saveInvoice({
              ...panelInvoice,
              reminders: [...(panelInvoice.reminders ?? []), log],
            });
          }}
          onClose={() => setPanel(null)}
        />
      )}
    </section>
  );
}

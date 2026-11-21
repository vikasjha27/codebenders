import { useState } from 'react';
import { buildReminderMessage, daysOverdue } from '../../domain/reminders';
import { outstandingOf } from '../../domain/payments';
import type { Invoice, ReminderChannel, ReminderLog, Student } from '../../domain/types';

export interface ReminderPanelProps {
  invoice: Invoice;
  student: Student | undefined;
  /** ISO yyyy-mm-dd. */
  today: string;
  onMarkSent(log: ReminderLog): void;
  onClose(): void;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** ISO datetime -> "DD/MM/YYYY HH:mm" in local time. */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** wa.me link digits: strip non-digits, prefix 91 when exactly 10 digits remain. */
function whatsappHref(phone: string, text: string): string | undefined {
  let digits = phone.replace(/\D/g, '');
  if (digits === '') return undefined;
  if (digits.length === 10) digits = '91' + digits;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function ReminderPanel({ invoice, student, today, onMarkSent, onClose }: ReminderPanelProps) {
  const days = daysOverdue(invoice, today);
  const outstanding = outstandingOf(invoice);
  const [text, setText] = useState(() =>
    buildReminderMessage({
      studentName: student?.studentName ?? 'your child',
      parentName: student?.parentName ?? 'Parent',
      invoiceNumber: invoice.invoiceNumber,
      outstanding,
      dueDate: invoice.dueDate,
      daysOverdue: days,
      billingNote: invoice.billingNote,
    }),
  );
  const [channel, setChannel] = useState<ReminderChannel>('WhatsApp');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function handleCopy() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(text);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  const waHref = student?.parentPhone ? whatsappHref(student.parentPhone, text) : undefined;
  const history = [...(invoice.reminders ?? [])].sort((a, b) => b.sentAt.localeCompare(a.sentAt));

  return (
    <div className="modal-backdrop">
      <div role="dialog" aria-modal="true" aria-label="Payment reminder" className="modal">
        <h2>Payment reminder</h2>

        <div className="field">
          <textarea
            aria-label="Reminder message"
            rows={10}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setCopyStatus('idle');
            }}
          />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-small" onClick={handleCopy}>
            Copy
          </button>
          {waHref && (
            <a className="btn btn-small" href={waHref} target="_blank" rel="noreferrer">
              Open in WhatsApp
            </a>
          )}
        </div>

        <p role="status" className="status-text">
          {copyStatus === 'copied' && 'Copied'}
          {copyStatus === 'failed' && 'Copy failed — select the text and copy manually'}
        </p>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="rm-channel">Channel</label>
            <select
              id="rm-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value as ReminderChannel)}
            >
              <option value="WhatsApp">WhatsApp</option>
              <option value="SMS">SMS</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onMarkSent({ sentAt: new Date().toISOString(), channel, message: text })}
          >
            Mark reminder sent
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <h3 className="small">Previous reminders</h3>
        {history.length === 0 ? (
          <p className="muted small">No reminders sent yet.</p>
        ) : (
          <ul className="small">
            {history.map((r, i) => (
              <li key={`${r.sentAt}-${i}`}>
                {formatDateTime(r.sentAt)} · {r.channel}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

import { useRef, useState, type FormEvent } from 'react';
import { recordPayment, outstandingOf } from '../../domain/payments';
import { formatINR } from '../../domain/money';
import type { Invoice, PaymentMode } from '../../domain/types';

export interface RecordPaymentFormProps {
  invoice: Invoice;
  /** ISO yyyy-mm-dd. */
  today: string;
  onSave(updated: Invoice): void;
  onCancel(): void;
}

const PAYMENT_MODES: PaymentMode[] = ['UPI', 'Cash', 'Bank Transfer', 'Other'];

export function RecordPaymentForm({ invoice, today, onSave, onCancel }: RecordPaymentFormProps) {
  const balance = outstandingOf(invoice);
  // Pre-fill with the balance due (plain number, at most 2 dp). The form mounts when opened, so this covers ?invoice= too.
  const [amount, setAmount] = useState(() => String(balance));
  const [paidOn, setPaidOn] = useState(today);
  const [mode, setMode] = useState<PaymentMode>('UPI');
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = recordPayment(invoice, { amount: Number(amount), paidOn, mode }, today);
    if (!result.invoice) {
      setError(result.error);
      return;
    }
    setError(null);
    onSave(result.invoice);
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit} noValidate>
      <p className="summary">
        <strong>Balance due: {formatINR(balance)}</strong>
      </p>

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            setAmount(String(balance));
            setError(null);
          }}
        >
          Full payment
        </button>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            setAmount('');
            setError(null);
            amountRef.current?.focus();
          }}
        >
          Partial
        </button>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="rpf-amount">Amount (₹)</label>
          <input
            id="rpf-amount"
            ref={amountRef}
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="rpf-date">Payment date</label>
          <input
            id="rpf-date"
            type="date"
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="rpf-mode">Mode</label>
          <select
            id="rpf-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as PaymentMode)}
          >
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          Save payment
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

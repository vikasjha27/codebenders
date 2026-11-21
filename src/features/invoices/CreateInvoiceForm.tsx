import { useState, type FormEvent } from 'react';
import { addDays, parseISODate, toISODate } from '../../domain/dates';
import { createInvoice } from '../../domain/invoiceOps';
import type { Invoice, Student } from '../../domain/types';

export interface CreateInvoiceFormProps {
  students: Student[];
  existingInvoices: Invoice[];
  /** ISO yyyy-mm-dd. */
  today: string;
  onCreate(invoice: Invoice): void;
  onCancel(): void;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Next occurrence of dueDay (clamped to 1–28) on or after issueDate, as yyyy-mm-dd. */
function nextDueDate(issueDate: string, dueDay: number): string {
  const day = Math.min(28, Math.max(1, Math.round(dueDay)));
  const issue = parseISODate(issueDate);
  let due = new Date(issue.getFullYear(), issue.getMonth(), day);
  if (due < issue) {
    due = new Date(issue.getFullYear(), issue.getMonth() + 1, day);
  }
  return toISODate(due);
}

/** Default due date: the student's dueDay if set, otherwise issue date + 7 days. */
function defaultDueDate(issueDate: string, studentId: string, students: Student[]): string {
  if (!ISO_DATE.test(issueDate)) return issueDate;
  const student = students.find((s) => s.id === studentId);
  if (student && typeof student.dueDay === 'number' && student.dueDay > 0) {
    return nextDueDate(issueDate, student.dueDay);
  }
  return addDays(issueDate, 7);
}

export function CreateInvoiceForm({
  students,
  existingInvoices,
  today,
  onCreate,
  onCancel,
}: CreateInvoiceFormProps) {
  const [studentId, setStudentId] = useState('');
  const [amount, setAmount] = useState('');
  const [billingNote, setBillingNote] = useState('');
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(() => addDays(today, 7));
  const [dueTouched, setDueTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleStudentChange(id: string) {
    setStudentId(id);
    if (!dueTouched) setDueDate(defaultDueDate(issueDate, id, students));
  }

  function handleIssueDateChange(value: string) {
    setIssueDate(value);
    if (!dueTouched) setDueDate(defaultDueDate(value, studentId, students));
  }

  function resetForm() {
    setStudentId('');
    setAmount('');
    setBillingNote('');
    setIssueDate(today);
    setDueDate(addDays(today, 7));
    setDueTouched(false);
    setError(null);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const year = Number(issueDate.slice(0, 4));
    const result = createInvoice(
      { studentId, amount: Number(amount), issueDate, dueDate, billingNote },
      existingInvoices,
      year,
    );
    if (!result.invoice) {
      setError(result.error);
      return;
    }
    onCreate(result.invoice);
    resetForm();
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="ci-student">Student</label>
          <select
            id="ci-student"
            value={studentId}
            onChange={(e) => handleStudentChange(e.target.value)}
          >
            <option value="">Select student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.studentName}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="ci-amount">Amount (₹)</label>
          <input
            id="ci-amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="ci-note">Billing note</label>
          <input
            id="ci-note"
            type="text"
            placeholder="e.g. Nov Class 10 Maths"
            value={billingNote}
            onChange={(e) => setBillingNote(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="ci-issue">Issue date</label>
          <input
            id="ci-issue"
            type="date"
            value={issueDate}
            onChange={(e) => handleIssueDateChange(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="ci-due">Due date</label>
          <input
            id="ci-due"
            type="date"
            value={dueDate}
            onChange={(e) => {
              setDueTouched(true);
              setDueDate(e.target.value);
            }}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          Create invoice
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

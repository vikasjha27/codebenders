import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Invoice } from '../../domain/types';
import { RecordPaymentForm } from './RecordPaymentForm';

const invoice: Invoice = {
  id: 'i1',
  studentId: 's1',
  invoiceNumber: 'TD-2025-0001',
  amount: 1000,
  issueDate: '2025-04-01',
  dueDate: '2025-04-08',
  paidAmount: 0,
  status: 'Sent',
  payments: [],
  reminders: [],
};

describe('RecordPaymentForm', () => {
  it('records a partial payment and reports the updated invoice', () => {
    const onSave = vi.fn();
    render(
      <RecordPaymentForm invoice={invoice} today="2025-04-15" onSave={onSave} onCancel={() => {}} />,
    );

    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '400' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save payment' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const updated = onSave.mock.calls[0][0] as Invoice;
    expect(updated.paidAmount).toBe(400);
    expect(updated.status).toBe('Partially Paid');
  });

  it('shows an alert and does not save when the amount exceeds the balance', () => {
    const onSave = vi.fn();
    render(
      <RecordPaymentForm invoice={invoice} today="2025-04-15" onSave={onSave} onCancel={() => {}} />,
    );

    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '1500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save payment' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/more than the balance/);
  });

  it('pre-fills the amount with the full balance when nothing has been paid', () => {
    render(<RecordPaymentForm invoice={invoice} today="2025-04-15" onSave={() => {}} onCancel={() => {}} />);
    expect((screen.getByLabelText(/Amount/) as HTMLInputElement).value).toBe('1000');
  });

  it('pre-fills the amount with the remaining balance after a part payment', () => {
    render(
      <RecordPaymentForm
        invoice={{ ...invoice, paidAmount: 400 }}
        today="2025-04-15"
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect((screen.getByLabelText(/Amount/) as HTMLInputElement).value).toBe('600');
  });
});

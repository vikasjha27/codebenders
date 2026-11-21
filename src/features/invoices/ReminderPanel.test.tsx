import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invoice, Student } from '../../domain/types';
import { ReminderPanel } from './ReminderPanel';

const invoice: Invoice = {
  id: 'i1',
  studentId: 's1',
  invoiceNumber: 'TD-2025-0001',
  amount: 1000,
  issueDate: '2025-04-01',
  dueDate: '2025-04-08',
  paidAmount: 0,
  status: 'Sent',
  billingNote: 'Apr Class 10 Maths',
  payments: [],
  reminders: [],
};

const student: Student = {
  id: 's1',
  studentName: 'Aarav',
  parentName: 'Mrs Sharma',
  parentPhone: '9876543210',
  className: '10',
  subject: 'Maths',
  feeModel: 'monthly',
  feeAmount: 1000,
  dueDay: 8,
  active: true,
};

describe('ReminderPanel', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('copies the reminder text containing the invoice number', async () => {
    render(
      <ReminderPanel
        invoice={invoice}
        student={student}
        today="2025-04-15"
        onMarkSent={() => {}}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    const copied = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
    expect(typeof copied).toBe('string');
    expect(copied).toContain('TD-2025-0001');
    expect(await screen.findByRole('status')).toHaveTextContent('Copied');
  });

  it('marks a reminder as sent via WhatsApp and links to the parent number', async () => {
    const onMarkSent = vi.fn();
    render(
      <ReminderPanel
        invoice={invoice}
        student={student}
        today="2025-04-15"
        onMarkSent={onMarkSent}
        onClose={() => {}}
      />,
    );

    const link = screen.getByRole('link', { name: 'Open in WhatsApp' });
    expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/);

    fireEvent.click(screen.getByRole('button', { name: 'Mark reminder sent' }));

    expect(onMarkSent).toHaveBeenCalledTimes(1);
    const log = onMarkSent.mock.calls[0][0];
    expect(log.channel).toBe('WhatsApp');
    expect(typeof log.sentAt).toBe('string');
  });
});

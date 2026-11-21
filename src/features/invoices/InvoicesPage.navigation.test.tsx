import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { addDays } from '../../domain/dates';
import type { AppData } from '../../domain/types';
import { todayISO } from '../../domain/today';
import type { AppDataContextValue } from '../../storage/AppDataProvider';
import { InvoicesPage } from './InvoicesPage';

const mockState = vi.hoisted(() => ({ value: null as unknown }));

vi.mock('../../storage/AppDataProvider', () => ({
  useAppData: () => mockState.value as AppDataContextValue,
}));

function contextFor(data: AppData): AppDataContextValue {
  return {
    status: 'ready',
    data,
    dismissSaveError: vi.fn(),
    update: vi.fn(),
    resetDemo: vi.fn(),
    downloadRawBackup: vi.fn(),
    replaceWithDemoData: vi.fn(),
  };
}

function buildData(today: string, paidAmount: number): AppData {
  return {
    schemaVersion: 1,
    students: [
      {
        id: 's1',
        studentName: 'Asha',
        parentName: 'Ravi',
        className: '10',
        subject: 'Maths',
        feeModel: 'monthly',
        feeAmount: 2000,
        dueDay: 5,
        active: true,
      },
    ],
    invoices: [
      {
        id: 'inv-overdue',
        studentId: 's1',
        invoiceNumber: 'INV-001',
        amount: 2000,
        issueDate: addDays(today, -65),
        dueDate: addDays(today, -35),
        paidAmount,
        status: 'Sent',
      },
    ],
    bills: [],
    cash: { balance: 1000, asOfDate: today },
    assumptions: { expectedCollectionRate: 0.9, defaultPaymentDelayDays: 7 },
  };
}

describe('InvoicesPage navigation', () => {
  it('opens the payment form for the invoice named in ?invoice=', () => {
    mockState.value = contextFor(buildData(todayISO(), 0));
    render(
      <MemoryRouter initialEntries={['/invoices?invoice=inv-overdue']}>
        <InvoicesPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Save payment' })).toBeInTheDocument();
  });

  it('does not open the payment form when the named invoice is Paid', () => {
    mockState.value = contextFor(buildData(todayISO(), 2000));
    render(
      <MemoryRouter initialEntries={['/invoices?invoice=inv-overdue']}>
        <InvoicesPage />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: 'Save payment' })).not.toBeInTheDocument();
  });
});

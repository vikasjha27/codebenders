import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { addDays } from '../../domain/dates';
import type { AppData } from '../../domain/types';
import { todayISO } from '../../domain/today';
import type { AppDataContextValue } from '../../storage/AppDataProvider';
import { DashboardPage } from './DashboardPage';

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

/** One student with an invoice 35 days overdue, and a rent bill due in 3 days that cash cannot cover. */
function buildData(today: string): AppData {
  return {
    schemaVersion: 1,
    students: [
      {
        id: 's1',
        studentName: 'Asha',
        parentName: 'Ravi',
        parentPhone: '9876543210',
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
        paidAmount: 0,
        status: 'Sent',
      },
    ],
    bills: [
      {
        id: 'bill-rent',
        name: 'Rent',
        category: 'Rent',
        amount: 50000,
        frequency: 'monthly',
        nextDueDate: addDays(today, 3),
        paidForCycle: false,
      },
    ],
    cash: { balance: 1000, asOfDate: today },
    assumptions: { expectedCollectionRate: 0.9, defaultPaymentDelayDays: 7 },
  };
}

function renderDashboard(): void {
  mockState.value = contextFor(buildData(todayISO()));
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe('DashboardPage', () => {
  it('renders the Chase this today section with a critical overdue alert', () => {
    renderDashboard();
    expect(screen.getByRole('heading', { name: 'Chase this today' })).toBeInTheDocument();
    expect(screen.getByText(/overdue 35 days/)).toBeInTheDocument();
    expect(screen.getAllByText('critical')[0]).toHaveClass('badge-critical');
  });

  it('links a record_payment alert to the invoice payment form', () => {
    renderDashboard();
    const links = screen.getAllByRole('link', { name: 'Record payment' });
    const alertLink = links.find((a) => a.getAttribute('href') === '/invoices?invoice=inv-overdue');
    expect(alertLink).toBeDefined();
  });

  it('renders the what-if section with the default late-days input', () => {
    renderDashboard();
    expect(screen.getByLabelText('Client pays late by (days)')).toHaveDisplayValue('15');
  });
});

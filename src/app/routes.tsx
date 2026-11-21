import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ExpensesPage } from '../features/expenses/ExpensesPage';
import { InvoicesPage } from '../features/invoices/InvoicesPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { StudentsPage } from '../features/students/StudentsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'students', element: <StudentsPage /> },
      { path: 'invoices', element: <InvoicesPage /> },
      { path: 'expenses', element: <ExpensesPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

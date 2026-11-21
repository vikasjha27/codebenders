import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAppData } from '../storage/AppDataProvider';
import { ErrorBanner } from './ErrorBanner';
import { ErrorBoundary } from './ErrorBoundary';
import { RecoveryBanner } from './RecoveryBanner';

const NAV_ITEMS: { to: string; label: string }[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/students', label: 'Students' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/settings', label: 'Settings' },
];

export function Layout(): JSX.Element {
  const { recovery, saveError, dismissSaveError, downloadRawBackup, replaceWithDemoData } = useAppData();
  const location = useLocation();

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="brand">TutorDesk</span>
      </header>

      <nav className="app-sidebar" aria-label="Main">
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.to === '/'} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main className="app-main">
        {recovery && (
          <RecoveryBanner
            message={recovery.message}
            hasRaw={recovery.raw !== null}
            onDownloadRaw={downloadRawBackup}
            onReplaceWithDemo={replaceWithDemoData}
          />
        )}
        {saveError && <ErrorBanner message={saveError} onDismiss={dismissSaveError} />}
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}

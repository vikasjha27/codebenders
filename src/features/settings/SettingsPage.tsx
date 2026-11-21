import { BusinessCard } from '../../components/BusinessCard';
import { Spinner } from '../../components/Spinner';
import { formatDMY } from '../../domain/dates';
import { formatINR } from '../../domain/money';
import { useAppData } from '../../storage/AppDataProvider';

const DEMO_RESET_CONFIRM =
  'This will erase all TutorDesk data and reload demo data. Continue?';

export function SettingsPage(): JSX.Element {
  const { status, data, resetDemo } = useAppData();
  if (status === 'loading') return <Spinner />;

  const handleReset = (): void => {
    if (window.confirm(DEMO_RESET_CONFIRM)) {
      resetDemo();
    }
  };

  return (
    <section>
      <h1>Settings</h1>

      <h2>Cash</h2>
      <dl className="details">
        <dt>Cash balance</dt>
        <dd>{formatINR(data.cash.balance)}</dd>
        <dt>As of</dt>
        <dd>{formatDMY(data.cash.asOfDate)}</dd>
      </dl>

      <h2>Forecast assumptions</h2>
      <dl className="details">
        <dt>Expected collection rate</dt>
        <dd>{Math.round(data.assumptions.expectedCollectionRate * 100)}%</dd>
        <dt>Default payment delay</dt>
        <dd>{data.assumptions.defaultPaymentDelayDays} days</dd>
      </dl>

      <h2>Business case</h2>
      <BusinessCard />

      <h2>Demo data</h2>
      <p className="muted">Replaces everything stored in this browser with the sample data set.</p>
      <button type="button" className="btn btn-danger" onClick={handleReset}>
        Reset Demo Data
      </button>
    </section>
  );
}

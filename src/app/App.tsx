import { RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AppDataProvider } from '../storage/AppDataProvider';
import { router } from './routes';

export function App(): JSX.Element {
  return (
    <ErrorBoundary fallbackTitle="TutorDesk could not start.">
      <AppDataProvider>
        <RouterProvider router={router} />
      </AppDataProvider>
    </ErrorBoundary>
  );
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Spinner } from '../components/Spinner';
import type { AppData } from '../domain/types';
import { todayISO } from '../domain/today';
import { buildSeedData } from '../seed/seedData';
import { resetDemoData } from '../seed/resetDemo';
import { createLocalStorageAdapter, type StorageAdapter } from './adapter';
import { loadAppData, loadRawForDiagnostics, saveAppDataResult } from './repository';
import { STORAGE_KEY, emptyAppData } from './schema';

export type LoadStatus = 'loading' | 'ready';

export interface AppDataContextValue {
  status: LoadStatus;
  data: AppData;
  /** Set when stored data could not be loaded. Mirrors `recovery.message` when corrupt. */
  error?: string;
  /**
   * Set when stored data is corrupt or unreadable. Nothing is written or overwritten automatically;
   * the app shows empty data until the user picks a recovery action.
   */
  recovery?: { message: string; raw: string | null };
  /** Set when the last write failed. Data is left at the last successfully saved state. */
  saveError?: string;
  /** Clears saveError. */
  dismissSaveError: () => void;
  /** Persists `next` and makes it the current data. On failure, data is unchanged and saveError is set. */
  update: (next: AppData) => void;
  /** Erases stored data, loads fresh demo data, and makes it current. */
  resetDemo: () => void;
  /** Downloads the raw stored text so it can be kept before recovery. No-op when there is nothing to download. */
  downloadRawBackup: () => void;
  /** Explicit user action: writes demo data over the corrupt stored data and clears recovery. */
  replaceWithDemoData: () => void;
}

interface HydratedState {
  status: LoadStatus;
  data: AppData;
  error?: string;
  recovery?: { message: string; raw: string | null };
  saveError?: string;
}

const BLOCKED_WRITE_MESSAGE =
  'Your saved data could not be read, so this change was not saved. Download a backup or replace the stored data with demo data first.';

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

/** True only when nothing is stored under the app key. A read failure counts as not empty. */
function isStorageEmpty(adapter: StorageAdapter): boolean {
  try {
    return adapter.get(STORAGE_KEY) === null;
  } catch {
    return false;
  }
}

/**
 * Loads stored data. Seeds demo data only when storage is empty (first run).
 * Corrupt or unreadable data is never written over: the app uses empty data and records recovery info.
 */
function hydrate(adapter: StorageAdapter): HydratedState {
  const result = loadAppData(adapter);
  if (result.error !== undefined) {
    return {
      status: 'ready',
      data: emptyAppData(),
      error: result.error,
      recovery: { message: result.error, raw: loadRawForDiagnostics(adapter) },
    };
  }
  if (isStorageEmpty(adapter)) {
    return { status: 'ready', data: resetDemoData(adapter, todayISO()) };
  }
  return { status: 'ready', data: result.data };
}

export function AppDataProvider({ children }: { children: ReactNode }): JSX.Element {
  const adapter = useMemo(() => createLocalStorageAdapter(), []);
  const [state, setState] = useState<HydratedState>({ status: 'loading', data: emptyAppData() });
  // StrictMode runs effects twice; hydrate only once so the first run's error is not overwritten.
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    setState(hydrate(adapter));
  }, [adapter]);

  const inRecovery = state.recovery !== undefined;
  const recoveryRaw = state.recovery?.raw ?? null;

  const update = useCallback(
    (next: AppData) => {
      // While stored data is corrupt, a write would overwrite the raw value. Refuse it.
      if (inRecovery) {
        setState((prev) => ({ ...prev, saveError: BLOCKED_WRITE_MESSAGE }));
        return;
      }
      const result = saveAppDataResult(adapter, next);
      if (result.ok) {
        setState((prev) => ({ ...prev, data: next, saveError: undefined }));
      } else {
        setState((prev) => ({ ...prev, saveError: result.error }));
      }
    },
    [adapter, inRecovery],
  );

  const resetDemo = useCallback(() => {
    const next = buildSeedData(todayISO());
    const result = saveAppDataResult(adapter, next);
    if (result.ok) {
      setState({ status: 'ready', data: next });
    } else {
      setState((prev) => ({ ...prev, saveError: result.error }));
    }
  }, [adapter]);

  const dismissSaveError = useCallback(() => {
    setState((prev) => ({ ...prev, saveError: undefined }));
  }, []);

  const downloadRawBackup = useCallback(() => {
    if (recoveryRaw === null) return;
    try {
      const blob = new Blob([recoveryRaw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'tutordesk-raw-backup.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setState((prev) => ({ ...prev, saveError: `Could not download the backup: ${message}` }));
    }
  }, [recoveryRaw]);

  const value = useMemo<AppDataContextValue>(
    () => ({
      status: state.status,
      data: state.data,
      error: state.error,
      recovery: state.recovery,
      saveError: state.saveError,
      dismissSaveError,
      update,
      resetDemo,
      downloadRawBackup,
      replaceWithDemoData: resetDemo,
    }),
    [state, dismissSaveError, update, resetDemo, downloadRawBackup],
  );

  if (state.status === 'loading') return <Spinner />;

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (ctx === undefined) {
    throw new Error('useAppData must be used inside <AppDataProvider>.');
  }
  return ctx;
}

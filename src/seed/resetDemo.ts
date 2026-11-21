import { todayISO } from '../domain/today';
import type { AppData } from '../domain/types';
import type { StorageAdapter } from '../storage/adapter';
import { saveAppData } from '../storage/repository';
import { buildSeedData } from './seedData';

// Re-exported so existing imports from this module keep working; the definition lives in domain/today.
export { todayISO };

/** Replaces all stored data with freshly built demo data and returns it. */
export function resetDemoData(adapter: StorageAdapter, today: string): AppData {
  const data = buildSeedData(today);
  saveAppData(adapter, data);
  return data;
}

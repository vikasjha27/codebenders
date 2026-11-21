import type { AppData } from '../domain/types';

export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'tutordesk:data:v1';

/** Defaults used when nothing is stored or the stored data cannot be used. */
export function emptyAppData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    students: [],
    invoices: [],
    bills: [],
    cash: { balance: 0, asOfDate: '1970-01-01' },
    assumptions: { expectedCollectionRate: 0.85, defaultPaymentDelayDays: 7 },
  };
}

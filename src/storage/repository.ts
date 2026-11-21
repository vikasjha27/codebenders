import type { AppData, Bill, Invoice, Student } from '../domain/types';
import type { StorageAdapter } from './adapter';
import { SCHEMA_VERSION, STORAGE_KEY, emptyAppData } from './schema';

export interface LoadResult {
  data: AppData;
  /** Set when stored data existed but could not be used; `data` is then emptyAppData(). */
  error?: string;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function hasAppDataShape(v: Record<string, unknown>): boolean {
  const isObj = (x: unknown) => typeof x === 'object' && x !== null;
  return (
    Array.isArray(v.students) &&
    Array.isArray(v.invoices) &&
    Array.isArray(v.bills) &&
    isObj(v.cash) &&
    isObj(v.assumptions)
  );
}

/** Loads AppData from storage. Never throws. */
export function loadAppData(adapter: StorageAdapter): LoadResult {
  let raw: string | null;
  try {
    raw = adapter.get(STORAGE_KEY);
  } catch (e) {
    return { data: emptyAppData(), error: `Could not read storage: ${errorMessage(e)}` };
  }
  if (raw === null) return { data: emptyAppData() };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { data: emptyAppData(), error: 'Saved data is corrupt (invalid JSON). Starting fresh.' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { data: emptyAppData(), error: 'Saved data is corrupt (not an object). Starting fresh.' };
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.schemaVersion !== SCHEMA_VERSION) {
    return {
      data: emptyAppData(),
      error: `Saved data has unsupported schema version ${String(obj.schemaVersion)} (expected ${SCHEMA_VERSION}).`,
    };
  }
  if (!hasAppDataShape(obj)) {
    return { data: emptyAppData(), error: 'Saved data is malformed. Starting fresh.' };
  }
  return { data: parsed as AppData };
}

/**
 * The raw stored text, for backup when loadAppData reports corrupt data. Reads only; never writes.
 * Returns null when nothing is stored or the read fails.
 */
export function loadRawForDiagnostics(adapter: StorageAdapter): string | null {
  try {
    return adapter.get(STORAGE_KEY);
  } catch {
    return null;
  }
}

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Saves AppData. Never throws; a failed write is reported with a user-facing error message. */
export function saveAppDataResult(adapter: StorageAdapter, data: AppData): SaveResult {
  try {
    adapter.set(STORAGE_KEY, JSON.stringify(data));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Could not save to this browser: ${errorMessage(e)}` };
  }
}

/** Saves AppData. Returns false (never throws) if the write fails. */
export function saveAppData(adapter: StorageAdapter, data: AppData): boolean {
  return saveAppDataResult(adapter, data).ok;
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id)
    ? list.map((x) => (x.id === item.id ? item : x))
    : [...list, item];
}

export function upsertStudent(data: AppData, student: Student): AppData {
  return { ...data, students: upsertById(data.students, student) };
}

/** Removes a student and their invoices, so no invoice is left pointing at a missing student. */
export function deleteStudent(data: AppData, studentId: string): AppData {
  return {
    ...data,
    students: data.students.filter((s) => s.id !== studentId),
    invoices: data.invoices.filter((i) => i.studentId !== studentId),
  };
}

export function upsertInvoice(data: AppData, invoice: Invoice): AppData {
  return { ...data, invoices: upsertById(data.invoices, invoice) };
}

export function upsertBill(data: AppData, bill: Bill): AppData {
  return { ...data, bills: upsertById(data.bills, bill) };
}

/** Marks a bill's current cycle as paid. Does not advance nextDueDate; that is a separate step. */
export function markBillPaid(data: AppData, billId: string): AppData {
  return {
    ...data,
    bills: data.bills.map((b) => (b.id === billId ? { ...b, paidForCycle: true } : b)),
  };
}

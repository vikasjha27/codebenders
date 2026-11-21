import { describe, it, expect } from 'vitest';
import { createMemoryAdapter } from './adapter';
import { loadAppData, saveAppData, saveAppDataResult, upsertStudent } from './repository';
import { STORAGE_KEY, emptyAppData } from './schema';
import type { Student } from '../domain/types';

describe('loadAppData', () => {
  it('returns empty data without error when nothing is stored', () => {
    const result = loadAppData(createMemoryAdapter());
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(emptyAppData());
  });

  it('reports an error and does not throw on corrupt JSON', () => {
    const adapter = createMemoryAdapter();
    adapter.set(STORAGE_KEY, '{not valid json');
    let result: ReturnType<typeof loadAppData> | undefined;
    expect(() => {
      result = loadAppData(adapter);
    }).not.toThrow();
    expect(result?.error).toBeDefined();
    expect(result?.data).toEqual(emptyAppData());
  });

  it('reports an error for a different schemaVersion', () => {
    const adapter = createMemoryAdapter();
    adapter.set(STORAGE_KEY, JSON.stringify({ ...emptyAppData(), schemaVersion: 99 }));
    expect(loadAppData(adapter).error).toBeDefined();
  });
});

describe('save/load round trip', () => {
  it('returns exactly what was saved', () => {
    const adapter = createMemoryAdapter();
    const student: Student = {
      id: 'stu-1',
      studentName: 'Aarav Sharma',
      parentName: 'Meera Sharma',
      parentPhone: '9800000000',
      className: '10',
      subject: 'Maths',
      feeModel: 'monthly',
      feeAmount: 3000,
      dueDay: 5,
      active: true,
    };
    const data = upsertStudent(emptyAppData(), student);
    expect(saveAppData(adapter, data)).toBe(true);

    const loaded = loadAppData(adapter);
    expect(loaded.error).toBeUndefined();
    expect(loaded.data).toEqual(data);
  });
});

describe('saveAppDataResult', () => {
  it('returns ok when the write succeeds', () => {
    expect(saveAppDataResult(createMemoryAdapter(), emptyAppData())).toEqual({ ok: true });
  });

  it('returns a visible error instead of throwing when the write fails', () => {
    const adapter = { ...createMemoryAdapter(), set: () => { throw new Error('quota exceeded'); } };
    let result: ReturnType<typeof saveAppDataResult> | undefined;
    expect(() => {
      result = saveAppDataResult(adapter, emptyAppData());
    }).not.toThrow();
    expect(result?.ok).toBe(false);
    expect(result && !result.ok ? result.error : '').toContain('Could not save');
  });
});

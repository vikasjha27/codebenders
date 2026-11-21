/** Minimal key/value storage. Implementations may throw (quota, disabled storage); callers handle that. */
export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** In-memory adapter, used by tests and as a fallback when localStorage is unavailable. */
export function createMemoryAdapter(): StorageAdapter {
  const map = new Map<string, string>();
  return {
    get: (key) => (map.has(key) ? (map.get(key) as string) : null),
    set: (key, value) => {
      map.set(key, value);
    },
    remove: (key) => {
      map.delete(key);
    },
  };
}

/**
 * Adapter over window.localStorage. Falls back to an in-memory adapter when
 * localStorage is missing or blocked (e.g. some private-browsing modes).
 */
export function createLocalStorageAdapter(): StorageAdapter {
  let ls: Storage | null = null;
  try {
    ls = typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    ls = null;
  }
  if (!ls) return createMemoryAdapter();
  const store = ls;
  return {
    get: (key) => store.getItem(key),
    set: (key, value) => store.setItem(key, value),
    remove: (key) => store.removeItem(key),
  };
}

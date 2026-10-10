import type { StorageAdapter } from './StorageAdapter';

export function createMemoryStorage(): StorageAdapter {
  const entries = new Map<string, string>();
  return {
    getString: key => entries.get(key),
    setString: (key, value) => {
      entries.set(key, value);
    },
    delete: key => {
      entries.delete(key);
    },
  };
}

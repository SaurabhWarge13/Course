import { MMKV } from 'react-native-mmkv';
import type { StorageAdapter } from './StorageAdapter';

export function createMmkvStorage(id: string): StorageAdapter {
  const store = new MMKV({ id });
  return {
    getString: key => store.getString(key),
    setString: (key, value) => store.set(key, value),
    delete: key => store.delete(key),
  };
}

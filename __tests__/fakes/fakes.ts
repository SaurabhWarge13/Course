import type { Session } from '../../src/domain/auth/types';
import type { CoursesApi } from '../../src/infrastructure/api/coursesApi';
import type { Connectivity, ConnectivityStatus } from '../../src/infrastructure/network/connectivity';
import type { LoadSessionResult, TokenStorage } from '../../src/infrastructure/secure/TokenStorage';
import type { StorageAdapter } from '../../src/infrastructure/storage/StorageAdapter';

export type FakeTokenStorage = TokenStorage & {
  stored: Session | null;
  loadResult: LoadSessionResult | null;
  failSaves: number;
  failClears: number;
  saveCalls: number;
  clearCalls: number;
};

export function createFakeTokenStorage(initial: Session | null = null): FakeTokenStorage {
  const fake: FakeTokenStorage = {
    stored: initial,
    loadResult: null,
    failSaves: 0,
    failClears: 0,
    saveCalls: 0,
    clearCalls: 0,
    async load() {
      if (fake.loadResult) {
        return fake.loadResult;
      }
      return fake.stored ? { kind: 'session', session: fake.stored } : { kind: 'none' };
    },
    async save(session) {
      fake.saveCalls += 1;
      if (fake.failSaves > 0) {
        fake.failSaves -= 1;
        throw new Error('keychain write failed');
      }
      fake.stored = session;
    },
    async clear() {
      fake.clearCalls += 1;
      if (fake.failClears > 0) {
        fake.failClears -= 1;
        throw new Error('keychain clear failed');
      }
      fake.stored = null;
    },
  };
  return fake;
}

export type FakeConnectivity = Connectivity & {
  setStatus(status: ConnectivityStatus): void;
};

export function createFakeConnectivity(initial: ConnectivityStatus = 'online'): FakeConnectivity {
  let status = initial;
  const listeners = new Set<() => void>();
  return {
    getStatus: () => status,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setStatus: next => {
      status = next;
      listeners.forEach(listener => listener());
    },
  };
}

export function createFakeCoursesApi(overrides: Partial<CoursesApi> = {}): jest.Mocked<CoursesApi> {
  return {
    getCourses: jest.fn(),
    getLessons: jest.fn(),
    completeLesson: jest.fn(),
    ...overrides,
  } as jest.Mocked<CoursesApi>;
}

export function createFailingStorage(base: StorageAdapter, failingKeys: string[]): StorageAdapter {
  return {
    ...base,
    setString: (key, value) => {
      if (failingKeys.includes(key)) {
        throw new Error(`write failed for ${key}`);
      }
      base.setString(key, value);
    },
  };
}

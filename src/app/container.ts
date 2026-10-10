import { type AuthRepository, createAuthRepository } from '../features/auth/AuthRepository';
import { type CourseRepository, createCourseRepository } from '../features/courses/CourseRepository';
import { createAuthApi } from '../infrastructure/api/authApi';
import { createCoursesApi } from '../infrastructure/api/coursesApi';
import { createAuthClient } from '../infrastructure/api/createAuthClient';
import { createProtectedClient } from '../infrastructure/api/createProtectedClient';
import { type DevControls, createDevControls } from '../infrastructure/api/mock/devControls';
import { installMockApi } from '../infrastructure/api/mock/installMockApi';
import { createMockServerState } from '../infrastructure/api/mock/mockServerState';
import { type SessionEvents, createSessionEvents } from '../infrastructure/api/sessionEvents';
import { type Connectivity, createConnectivity } from '../infrastructure/network/connectivity';
import { createKeychainTokenStorage } from '../infrastructure/secure/keychainTokenStorage';
import { type SessionContext, createSessionContext } from '../infrastructure/secure/sessionContext';
import { createSerialQueue } from '../infrastructure/secure/serialQueue';
import { createMmkvStorage } from '../infrastructure/storage/mmkvStorage';
import type { StorageAdapter } from '../infrastructure/storage/StorageAdapter';
import { config } from './config';

export type Container = {
  storage: StorageAdapter;
  sessionContext: SessionContext;
  sessionEvents: SessionEvents;
  connectivity: Connectivity;
  authRepository: AuthRepository;
  courseRepository: CourseRepository;
  devControls: DevControls | null;
};

export function createContainer(): Container {
  const storage = createMmkvStorage('app');
  const tokenStorage = createKeychainTokenStorage(config.keychainServiceId);
  const sessionContext = createSessionContext();
  const sessionEvents = createSessionEvents();
  const secureQueue = createSerialQueue();
  const connectivity = createConnectivity();

  const httpOptions = { baseUrl: config.apiBaseUrl, timeoutMs: config.requestTimeoutMs };
  const authClient = createAuthClient(httpOptions);
  const authApi = createAuthApi(authClient);
  const protectedClient = createProtectedClient({
    ...httpOptions,
    sessionContext,
    sessionEvents,
    refreshSession: authApi.refresh,
  });
  const coursesApi = createCoursesApi(protectedClient);

  let devControls: DevControls | null = null;
  if (config.useMockApi) {
    const mockState = createMockServerState(createMmkvStorage('mock-server'), {
      accessTokenTtlMs: config.mockAccessTokenTtlMs,
    });
    devControls = createDevControls(mockState);
    installMockApi({
      authClient,
      protectedClient,
      state: mockState,
      connectivity,
      devControls,
      latencyMs: config.mockLatencyMs,
      accessTokenTtlMs: config.mockAccessTokenTtlMs,
    });
  }

  return {
    storage,
    sessionContext,
    sessionEvents,
    connectivity,
    authRepository: createAuthRepository({ authApi, tokenStorage, storage, secureQueue, sessionContext }),
    courseRepository: createCourseRepository({ coursesApi, storage, sessionContext }),
    devControls,
  };
}

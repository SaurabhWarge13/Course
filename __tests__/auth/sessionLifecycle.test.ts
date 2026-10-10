import {
  CLEANUP_FAILED_MESSAGE,
  FIRST_LAUNCH_FAILED_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  SAVE_SESSION_FAILED_MESSAGE,
  SESSION_EXPIRED_NOTICE,
  SESSION_READ_FAILED_NOTICE,
  type SessionLifecycle,
  createSessionLifecycle,
} from '../../src/app/sessionLifecycle';
import { createAuthRepository } from '../../src/features/auth/AuthRepository';
import { type AuthStatus, createAuthStore } from '../../src/features/auth/authStore';
import type { Session } from '../../src/domain/auth/types';
import type { CourseRepository } from '../../src/features/courses/CourseRepository';
import { createCoursesStore } from '../../src/features/courses/coursesStore';
import type { AuthApi } from '../../src/infrastructure/api/authApi';
import { AppError } from '../../src/infrastructure/api/errors';
import { createSerialQueue } from '../../src/infrastructure/secure/serialQueue';
import { createSessionContext } from '../../src/infrastructure/secure/sessionContext';
import type { LoadSessionResult } from '../../src/infrastructure/secure/TokenStorage';
import { appKeys, userKeys } from '../../src/infrastructure/storage/keys';
import { createMemoryStorage } from '../../src/infrastructure/storage/memoryStorage';
import type { StorageAdapter } from '../../src/infrastructure/storage/StorageAdapter';
import { deferred } from '../fakes/deferred';
import { createFakeConnectivity, createFakeTokenStorage } from '../fakes/fakes';
import { alice, bob, pythonCourse, sessionFor } from '../fakes/fixtures';

type OneShotFailures = { set?: string[]; delete?: string[] };

function withOneShotFailures(base: StorageAdapter, failures: OneShotFailures): StorageAdapter {
  const pendingSet = new Set(failures.set);
  const pendingDelete = new Set(failures.delete);
  return {
    getString: key => base.getString(key),
    setString: (key, value) => {
      if (pendingSet.delete(key)) {
        throw new Error(`write failed: ${key}`);
      }
      base.setString(key, value);
    },
    delete: key => {
      if (pendingDelete.delete(key)) {
        throw new Error(`delete failed: ${key}`);
      }
      base.delete(key);
    },
  };
}

type SetupOptions = {
  storedSession?: Session | null;
  installed?: boolean;
  profileFor?: typeof alice | null;
  storageFailures?: OneShotFailures;
  pendingMarker?: boolean;
};

function setup({
  storedSession = null,
  installed = true,
  profileFor = null,
  storageFailures,
  pendingMarker = false,
}: SetupOptions = {}) {
  const baseStorage = createMemoryStorage();
  if (installed) {
    baseStorage.setString(appKeys.installed, '1');
  }
  if (pendingMarker) {
    baseStorage.setString(appKeys.pendingCredentialClear, '1');
  }
  if (profileFor) {
    baseStorage.setString(userKeys(profileFor.id).profile, JSON.stringify(profileFor));
  }
  const storage = storageFailures ? withOneShotFailures(baseStorage, storageFailures) : baseStorage;
  const tokenStorage = createFakeTokenStorage(storedSession);
  const sessionContext = createSessionContext();
  const authApi: jest.Mocked<AuthApi> = { login: jest.fn(), refresh: jest.fn() };
  const authRepository = createAuthRepository({
    authApi,
    tokenStorage,
    storage,
    secureQueue: createSerialQueue(),
    sessionContext,
  });
  const courseRepository: jest.Mocked<CourseRepository> = {
    readCached: jest.fn().mockReturnValue({ courses: [], lessonsByCourse: {} }),
    getCourses: jest.fn().mockResolvedValue({ data: [pythonCourse], source: 'network' }),
    getLessons: jest.fn(),
    completeLesson: jest.fn(),
  };
  const coursesStore = createCoursesStore({ courseRepository, sessionContext });
  const connectivity = createFakeConnectivity('online');
  let lifecycle: SessionLifecycle | undefined;
  const authStore = createAuthStore(() => {
    if (!lifecycle) {
      throw new Error('lifecycle not ready');
    }
    return lifecycle;
  });
  lifecycle = createSessionLifecycle({
    authRepository,
    courseRepository,
    sessionContext,
    connectivity,
    storage,
    authStore,
    coursesStore,
  });
  const statuses: AuthStatus[] = [];
  authStore.subscribe(state => statuses.push(state.status));

  return {
    lifecycle,
    authStore,
    coursesStore,
    storage,
    tokenStorage,
    sessionContext,
    authApi,
    courseRepository,
    connectivity,
    statuses,
  };
}

// Login is only accepted once restoration has settled, so flows that sign in start from a real restore.
async function setupSignedOut(options: SetupOptions = {}) {
  const context = setup(options);
  await context.lifecycle.restore();
  expect(context.authStore.getState().status).toBe('unauthenticated');
  context.statuses.length = 0;
  return context;
}

async function loginAs(context: ReturnType<typeof setup>, user: typeof alice, suffix = '1') {
  context.authApi.login.mockResolvedValueOnce({ session: sessionFor(user, suffix), user });
  await context.lifecycle.login(user.email, 'Password@123');
}

describe('initial state', () => {
  it('starts in restoring and shows no other status until restoration resolves', async () => {
    const context = setup({ storedSession: sessionFor(alice), profileFor: alice });
    const pendingLoad = deferred<LoadSessionResult>();
    context.tokenStorage.load = () => pendingLoad.promise;

    expect(context.authStore.getState().status).toBe('restoring');
    const restoring = context.lifecycle.restore();
    expect(context.statuses.filter(status => status !== 'restoring')).toEqual([]);

    pendingLoad.resolve({ kind: 'session', session: sessionFor(alice) });
    await restoring;
    expect(context.statuses.filter(status => status !== 'restoring')).toEqual(['authenticated']);
  });
});

describe('restore', () => {
  it('lands on login when nothing is stored', async () => {
    const context = setup();
    await context.lifecycle.restore();
    expect(context.authStore.getState().status).toBe('unauthenticated');
    expect(context.sessionContext.current()).toBeNull();
  });

  it('clears malformed credentials through the shared cleanup flow', async () => {
    const context = setup();
    context.tokenStorage.loadResult = { kind: 'malformed' };
    await context.lifecycle.restore();
    expect(context.tokenStorage.clearCalls).toBe(1);
    expect(context.authStore.getState().status).toBe('unauthenticated');
    expect(context.storage.getString(appKeys.pendingCredentialClear)).toBeUndefined();
  });

  it('blocks login when malformed credentials cannot be cleared, then recovers on retry', async () => {
    const context = setup();
    context.tokenStorage.loadResult = { kind: 'malformed' };
    context.tokenStorage.failClears = 1;
    await context.lifecycle.restore();
    expect(context.authStore.getState()).toMatchObject({
      status: 'cleanupRequired',
      errorMessage: CLEANUP_FAILED_MESSAGE,
    });

    await context.lifecycle.retryCleanup();
    expect(context.authStore.getState().status).toBe('unauthenticated');
  });

  it('retries a transient read once and restores when the retry succeeds', async () => {
    const context = setup({ profileFor: alice });
    context.tokenStorage.load = jest
      .fn<Promise<LoadSessionResult>, []>()
      .mockResolvedValueOnce({ kind: 'error', cause: new Error('locked') })
      .mockResolvedValueOnce({ kind: 'session', session: sessionFor(alice) });
    await context.lifecycle.restore();
    expect(context.authStore.getState()).toMatchObject({ status: 'authenticated', user: alice });
  });

  it('keeps the credential and explains itself when the read keeps failing', async () => {
    const context = setup({ storedSession: sessionFor(alice), profileFor: alice });
    context.tokenStorage.loadResult = { kind: 'error', cause: new Error('locked') };
    await context.lifecycle.restore();
    expect(context.tokenStorage.clearCalls).toBe(0);
    expect(context.tokenStorage.stored).not.toBeNull();
    expect(context.authStore.getState()).toMatchObject({
      status: 'unauthenticated',
      notice: SESSION_READ_FAILED_NOTICE,
    });
  });

  it('activates a stored session with a matching profile, hydrating before authenticating', async () => {
    const context = setup({ storedSession: sessionFor(alice), profileFor: alice });
    const order: string[] = [];
    context.courseRepository.readCached.mockImplementation(userId => {
      order.push(`hydrate:${userId}`);
      return { courses: [pythonCourse], lessonsByCourse: {} };
    });
    context.authStore.subscribe(state => {
      if (state.status === 'authenticated') {
        order.push('authenticated');
      }
    });

    await context.lifecycle.restore();

    expect(context.authStore.getState()).toMatchObject({ status: 'authenticated', user: alice });
    expect(context.sessionContext.current()).toMatchObject({ userId: alice.id, epoch: 1 });
    expect(order).toEqual([`hydrate:${alice.id}`, 'authenticated']);
    expect(context.coursesStore.getState().courses).toEqual([pythonCourse]);
    expect(context.courseRepository.getCourses).toHaveBeenCalledTimes(1);
  });

  it('runs once per runtime so a remount of the root component cannot re-activate the session', async () => {
    const context = setup({ storedSession: sessionFor(alice), profileFor: alice });

    await Promise.all([context.lifecycle.restore(), context.lifecycle.restore()]);
    await context.lifecycle.restore();

    expect(context.authStore.getState()).toMatchObject({ status: 'authenticated', user: alice });
    expect(context.sessionContext.current()).toMatchObject({ userId: alice.id, epoch: 1 });
    expect(context.statuses.filter(status => status === 'restoring')).toHaveLength(1);
    expect(context.courseRepository.readCached).toHaveBeenCalledTimes(1);
    expect(context.courseRepository.getCourses).toHaveBeenCalledTimes(1);
  });

  it('discards a stored session whose profile is missing', async () => {
    const context = setup({ storedSession: sessionFor(alice) });
    await context.lifecycle.restore();
    expect(context.tokenStorage.clearCalls).toBe(1);
    expect(context.authStore.getState().status).toBe('unauthenticated');
  });

  it('blocks login when a mismatched profile cannot be cleaned up, then recovers on retry', async () => {
    const context = setup({ storedSession: sessionFor(alice), profileFor: bob });
    context.tokenStorage.failClears = 1;
    await context.lifecycle.restore();
    expect(context.authStore.getState().status).toBe('cleanupRequired');
    expect(context.sessionContext.current()).toBeNull();

    await context.lifecycle.retryCleanup();
    expect(context.authStore.getState().status).toBe('unauthenticated');
    expect(context.tokenStorage.stored).toBeNull();
  });

  it('finishes a pending credential clear before loading anything', async () => {
    const context = setup({ storedSession: sessionFor(alice), profileFor: alice, pendingMarker: true });
    await context.lifecycle.restore();
    expect(context.tokenStorage.stored).toBeNull();
    expect(context.storage.getString(appKeys.pendingCredentialClear)).toBeUndefined();
    expect(context.authStore.getState().status).toBe('unauthenticated');
  });

  it('blocks on cleanupRequired when a pending clear keeps failing', async () => {
    const context = setup({ storedSession: sessionFor(alice), profileFor: alice, pendingMarker: true });
    context.tokenStorage.failClears = 1;
    await context.lifecycle.restore();
    expect(context.authStore.getState()).toMatchObject({
      status: 'cleanupRequired',
      errorMessage: CLEANUP_FAILED_MESSAGE,
    });
    expect(context.storage.getString(appKeys.pendingCredentialClear)).toBe('1');
    expect(context.sessionContext.current()).toBeNull();

    await context.lifecycle.retryCleanup();
    expect(context.authStore.getState().status).toBe('unauthenticated');
    expect(context.storage.getString(appKeys.pendingCredentialClear)).toBeUndefined();
  });

  it('stays blocked when a pending marker cannot be removed after a successful clear', async () => {
    const context = setup({
      storedSession: sessionFor(alice),
      profileFor: alice,
      pendingMarker: true,
      storageFailures: { delete: [appKeys.pendingCredentialClear] },
    });
    await context.lifecycle.restore();
    expect(context.tokenStorage.stored).toBeNull();
    expect(context.authStore.getState().status).toBe('cleanupRequired');
    expect(context.storage.getString(appKeys.pendingCredentialClear)).toBe('1');

    await context.lifecycle.retryCleanup();
    expect(context.authStore.getState().status).toBe('unauthenticated');
    expect(context.storage.getString(appKeys.pendingCredentialClear)).toBeUndefined();
  });

  it('clears credentials inherited from a previous install', async () => {
    const context = setup({ storedSession: sessionFor(alice), profileFor: alice, installed: false });
    await context.lifecycle.restore();
    expect(context.tokenStorage.clearCalls).toBe(1);
    expect(context.storage.getString(appKeys.installed)).toBe('1');
    expect(context.authStore.getState().status).toBe('unauthenticated');
  });

  it('blocks login until a failed first-launch clear succeeds', async () => {
    const context = setup({ storedSession: sessionFor(alice), profileFor: alice, installed: false });
    context.tokenStorage.failClears = 1;
    await context.lifecycle.restore();
    expect(context.authStore.getState()).toMatchObject({
      status: 'cleanupRequired',
      errorMessage: FIRST_LAUNCH_FAILED_MESSAGE,
    });
    expect(context.storage.getString(appKeys.installed)).toBeUndefined();

    await context.lifecycle.retryCleanup();
    expect(context.authStore.getState().status).toBe('unauthenticated');
    expect(context.storage.getString(appKeys.installed)).toBe('1');
    expect(context.tokenStorage.stored).toBeNull();
  });

  it('blocks login until the installed marker is written after a successful first-launch clear', async () => {
    const context = setup({
      installed: false,
      storageFailures: { set: [appKeys.installed] },
    });
    await context.lifecycle.restore();
    expect(context.tokenStorage.clearCalls).toBe(1);
    expect(context.authStore.getState()).toMatchObject({
      status: 'cleanupRequired',
      errorMessage: FIRST_LAUNCH_FAILED_MESSAGE,
    });

    await context.lifecycle.retryCleanup();
    expect(context.storage.getString(appKeys.installed)).toBe('1');
    expect(context.authStore.getState().status).toBe('unauthenticated');
  });
});

describe('login', () => {
  it('persists the session and profile, hydrates, then authenticates', async () => {
    const context = await setupSignedOut();
    await loginAs(context, alice);
    expect(context.tokenStorage.stored).toMatchObject({ userId: alice.id });
    expect(context.storage.getString(userKeys(alice.id).profile)).toContain(alice.email);
    expect(context.courseRepository.readCached).toHaveBeenCalledWith(alice.id);
    expect(context.authStore.getState()).toMatchObject({ status: 'authenticated', user: alice });
    expect(context.statuses).toEqual(['submitting', 'authenticated']);
  });

  it('reports invalid credentials', async () => {
    const context = await setupSignedOut();
    context.authApi.login.mockRejectedValueOnce(new AppError('unauthorized', 'nope'));
    await context.lifecycle.login(alice.email, 'wrong-password');
    expect(context.authStore.getState()).toMatchObject({
      status: 'unauthenticated',
      errorMessage: INVALID_CREDENTIALS_MESSAGE,
    });
  });

  it('does not authenticate when the session cannot be saved securely', async () => {
    const context = await setupSignedOut();
    context.tokenStorage.failSaves = 2;
    await loginAs(context, alice);
    expect(context.tokenStorage.saveCalls).toBe(2);
    expect(context.sessionContext.current()).toBeNull();
    expect(context.storage.getString(userKeys(alice.id).profile)).toBeUndefined();
    expect(context.authStore.getState()).toMatchObject({
      status: 'unauthenticated',
      errorMessage: SAVE_SESSION_FAILED_MESSAGE,
    });
  });

  it('succeeds when the second save attempt works', async () => {
    const context = await setupSignedOut();
    context.tokenStorage.failSaves = 1;
    await loginAs(context, alice);
    expect(context.authStore.getState().status).toBe('authenticated');
  });

  it('ignores a login while restoration is still running', async () => {
    const context = setup({ storedSession: sessionFor(alice), profileFor: alice });
    const pendingLoad = deferred<LoadSessionResult>();
    context.tokenStorage.load = () => pendingLoad.promise;
    const restoring = context.lifecycle.restore();

    await context.lifecycle.login(bob.email, 'Password@123');
    expect(context.authApi.login).not.toHaveBeenCalled();

    pendingLoad.resolve({ kind: 'session', session: sessionFor(alice) });
    await restoring;
    expect(context.authStore.getState()).toMatchObject({ status: 'authenticated', user: alice });
    expect(context.tokenStorage.stored).toMatchObject({ userId: alice.id });
  });

  it('ignores a login while sign-out is still clearing the credential', async () => {
    const context = await setupSignedOut();
    await loginAs(context, alice);
    const pendingClear = deferred<undefined>();
    const clear = context.tokenStorage.clear;
    context.tokenStorage.clear = async () => {
      await pendingClear.promise;
      await clear();
    };
    context.authApi.login.mockClear();

    const signingOut = context.lifecycle.logout();
    expect(context.authStore.getState().status).toBe('signingOut');
    await context.lifecycle.login(bob.email, 'Password@123');
    expect(context.authApi.login).not.toHaveBeenCalled();

    pendingClear.resolve(undefined);
    await signingOut;
    expect(context.authStore.getState().status).toBe('unauthenticated');
    expect(context.tokenStorage.stored).toBeNull();
    expect(context.sessionContext.current()).toBeNull();
  });

  it('keeps login blocked in cleanupRequired until a cleanup retry succeeds', async () => {
    const context = await setupSignedOut();
    await loginAs(context, alice);
    context.tokenStorage.failClears = 1;
    await context.lifecycle.logout();
    expect(context.authStore.getState().status).toBe('cleanupRequired');
    context.authApi.login.mockClear();

    await context.lifecycle.login(bob.email, 'Password@123');
    expect(context.authApi.login).not.toHaveBeenCalled();
    expect(context.authStore.getState().status).toBe('cleanupRequired');
    expect(context.tokenStorage.stored).toMatchObject({ userId: alice.id });

    await context.lifecycle.retryCleanup();
    expect(context.authApi.login).not.toHaveBeenCalled();
    expect(context.authStore.getState().status).toBe('unauthenticated');
    expect(context.tokenStorage.stored).toBeNull();
  });
});

describe('logout and expiry', () => {
  it('signs out through a blocking transition, clears credentials and keeps the user cache', async () => {
    const context = await setupSignedOut();
    await loginAs(context, alice);
    context.coursesStore.getState().hydrate(alice.id, { courses: [pythonCourse], lessonsByCourse: {} });
    context.storage.setString(userKeys(alice.id).courses, 'cached');

    await context.lifecycle.logout();

    expect(context.statuses.slice(-2)).toEqual(['signingOut', 'unauthenticated']);
    expect(context.tokenStorage.stored).toBeNull();
    expect(context.sessionContext.current()).toBeNull();
    expect(context.coursesStore.getState().courses).toEqual([]);
    expect(context.storage.getString(userKeys(alice.id).courses)).toBe('cached');
    expect(context.storage.getString(appKeys.pendingCredentialClear)).toBeUndefined();
  });

  it('stays in cleanupRequired until the credential clear succeeds', async () => {
    const context = await setupSignedOut();
    await loginAs(context, alice);
    context.tokenStorage.failClears = 1;

    await context.lifecycle.logout();
    expect(context.authStore.getState().status).toBe('cleanupRequired');
    expect(context.storage.getString(appKeys.pendingCredentialClear)).toBe('1');

    await context.lifecycle.retryCleanup();
    expect(context.authStore.getState().status).toBe('unauthenticated');
    expect(context.tokenStorage.stored).toBeNull();
  });

  it('still signs out when the marker cannot be written but the keychain clear succeeds', async () => {
    const context = await setupSignedOut({ storageFailures: { set: [appKeys.pendingCredentialClear] } });
    await loginAs(context, alice);

    await context.lifecycle.logout();

    expect(context.tokenStorage.stored).toBeNull();
    expect(context.authStore.getState().status).toBe('unauthenticated');
    expect(context.storage.getString(appKeys.pendingCredentialClear)).toBeUndefined();
  });

  it('blocks login when both the marker write and the keychain clear fail', async () => {
    const context = await setupSignedOut({ storageFailures: { set: [appKeys.pendingCredentialClear] } });
    await loginAs(context, alice);
    context.tokenStorage.failClears = 1;

    await context.lifecycle.logout();
    expect(context.authStore.getState().status).toBe('cleanupRequired');

    await context.lifecycle.retryCleanup();
    expect(context.authStore.getState().status).toBe('unauthenticated');
    expect(context.tokenStorage.stored).toBeNull();
  });

  it('blocks login when the marker cannot be deleted after a successful logout clear', async () => {
    const context = await setupSignedOut({ storageFailures: { delete: [appKeys.pendingCredentialClear] } });
    await loginAs(context, alice);

    await context.lifecycle.logout();
    expect(context.tokenStorage.stored).toBeNull();
    expect(context.authStore.getState().status).toBe('cleanupRequired');

    await context.lifecycle.retryCleanup();
    expect(context.authStore.getState().status).toBe('unauthenticated');
    expect(context.storage.getString(appKeys.pendingCredentialClear)).toBeUndefined();
  });

  it('expires only the session identified by the stamp', async () => {
    const context = await setupSignedOut();
    await loginAs(context, alice);
    const stamp = { userId: alice.id, epoch: 1 };

    context.lifecycle.onSessionExpired({ userId: alice.id, epoch: 0 });
    expect(context.authStore.getState().status).toBe('authenticated');

    context.lifecycle.onSessionExpired(stamp);
    await Promise.resolve();
    await Promise.resolve();
    expect(context.sessionContext.current()).toBeNull();
    expect(context.authStore.getState().notice).toBe(SESSION_EXPIRED_NOTICE);
  });

  it('hydrates only the new user after switching accounts', async () => {
    const context = await setupSignedOut();
    await loginAs(context, alice);
    await context.lifecycle.logout();
    await loginAs(context, bob);
    expect(context.courseRepository.readCached).toHaveBeenLastCalledWith(bob.id);
    expect(context.sessionContext.current()).toMatchObject({ userId: bob.id, epoch: 3 });
  });
});

describe('token rotation', () => {
  it('persists before publishing for the current session', async () => {
    const context = await setupSignedOut();
    await loginAs(context, alice);
    const rotated = sessionFor(alice, '2');

    await context.lifecycle.onTokensRotated(rotated, { userId: alice.id, epoch: 1 });

    expect(context.tokenStorage.stored).toEqual(rotated);
    expect(context.sessionContext.current()?.accessToken).toBe(rotated.accessToken);
  });

  it('ignores a rotation for a stale session and never saves after logout', async () => {
    const context = await setupSignedOut();
    await loginAs(context, alice);
    const staleStamp = { userId: alice.id, epoch: 1 };
    await context.lifecycle.logout();

    await context.lifecycle.onTokensRotated(sessionFor(alice, '2'), staleStamp);

    expect(context.tokenStorage.stored).toBeNull();
    expect(context.sessionContext.current()).toBeNull();
  });

  it('keeps serving the run in memory when persistence fails twice', async () => {
    const context = await setupSignedOut();
    await loginAs(context, alice);
    context.tokenStorage.failSaves = 2;
    const rotated = sessionFor(alice, '2');

    await context.lifecycle.onTokensRotated(rotated, { userId: alice.id, epoch: 1 });

    expect(context.tokenStorage.stored).toMatchObject({ accessToken: sessionFor(alice).accessToken });
    expect(context.sessionContext.current()?.accessToken).toBe(rotated.accessToken);
  });
});

describe('connectivity', () => {
  it('refreshes courses when the device comes back online', async () => {
    const context = await setupSignedOut();
    const stop = context.lifecycle.start();
    await loginAs(context, alice);
    context.courseRepository.getCourses.mockClear();

    context.connectivity.setStatus('offline');
    context.connectivity.setStatus('online');
    await Promise.resolve();

    expect(context.courseRepository.getCourses).toHaveBeenCalledTimes(1);
    stop();
  });
});

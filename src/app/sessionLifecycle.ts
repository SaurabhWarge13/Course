import type { AuthRepository } from '../features/auth/AuthRepository';
import type { AuthState, AuthStore, SessionActions } from '../features/auth/authStore';
import type { Session, SessionStamp, User } from '../domain/auth/types';
import type { CourseRepository } from '../features/courses/CourseRepository';
import type { CoursesStore } from '../features/courses/coursesStore';
import { isAppError, toUserMessage } from '../infrastructure/api/errors';
import { describeError, logger } from '../infrastructure/logger';
import type { Connectivity } from '../infrastructure/network/connectivity';
import type { SessionContext } from '../infrastructure/secure/sessionContext';
import type { LoadSessionResult } from '../infrastructure/secure/TokenStorage';
import { appKeys } from '../infrastructure/storage/keys';
import type { StorageAdapter } from '../infrastructure/storage/StorageAdapter';

export type SessionLifecycleDeps = {
  authRepository: AuthRepository;
  courseRepository: CourseRepository;
  sessionContext: SessionContext;
  connectivity: Connectivity;
  storage: StorageAdapter;
  authStore: AuthStore;
  coursesStore: CoursesStore;
};

export type SessionLifecycle = SessionActions & {
  restore(): Promise<void>;
  onTokensRotated(session: Session, stamp: SessionStamp): Promise<void>;
  onSessionExpired(stamp: SessionStamp): void;
  start(): () => void;
};

type RecoveryStep = 'credentialClear' | 'firstLaunch';

export const SESSION_EXPIRED_NOTICE = 'Your session expired. Please sign in again.';
export const SESSION_READ_FAILED_NOTICE =
  "We couldn't read your saved session. Please sign in again.";
export const CLEANUP_FAILED_MESSAGE =
  'We could not finish signing out securely. Please try again.';
export const FIRST_LAUNCH_FAILED_MESSAGE =
  'We could not prepare secure storage on this device. Please try again.';
export const SAVE_SESSION_FAILED_MESSAGE =
  'We could not securely save your session on this device. Please try again.';
export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';

function loginErrorMessage(error: unknown): string {
  if (!isAppError(error)) {
    return SAVE_SESSION_FAILED_MESSAGE;
  }
  return error.kind === 'unauthorized' ? INVALID_CREDENTIALS_MESSAGE : toUserMessage(error);
}

export function createSessionLifecycle(deps: SessionLifecycleDeps): SessionLifecycle {
  const { authRepository, courseRepository, sessionContext, connectivity, storage } = deps;
  const { authStore, coursesStore } = deps;
  let epoch = 0;
  let recovery: RecoveryStep | null = null;
  let restoration: Promise<void> | null = null;

  const setAuth = (patch: Partial<AuthState>) => authStore.setState(patch);
  const status = () => authStore.getState().status;

  const activate = (session: Session, user: User) => {
    epoch += 1;
    sessionContext.set(session, epoch);
    coursesStore.getState().hydrate(session.userId, courseRepository.readCached(session.userId));
    setAuth({ status: 'authenticated', user, errorMessage: null });
    coursesStore.getState().loadCourses();
  };

  const invalidate = () => {
    epoch += 1;
    sessionContext.clear();
    coursesStore.getState().reset();
  };

  const enterRecovery = (step: RecoveryStep) => {
    recovery = step;
    setAuth({
      status: 'cleanupRequired',
      user: null,
      errorMessage: step === 'firstLaunch' ? FIRST_LAUNCH_FAILED_MESSAGE : CLEANUP_FAILED_MESSAGE,
    });
  };

  // Resolves true only when the credential is gone and no pending-clear marker survives.
  const clearCredentials = async (): Promise<boolean> => {
    let markerWritten = true;
    try {
      storage.setString(appKeys.pendingCredentialClear, '1');
    } catch (error) {
      markerWritten = false;
      logger.error('session.clear-marker-failed', { error: describeError(error) });
    }
    try {
      await authRepository.clearSession();
    } catch (error) {
      // Without a durable marker, recovery across a restart cannot be promised; login stays blocked here.
      logger.error(markerWritten ? 'session.clear-failed' : 'session.clear-unrecoverable', {
        error: describeError(error),
      });
      return false;
    }
    try {
      // A surviving marker would wipe the credentials of the next login on the following launch.
      storage.delete(appKeys.pendingCredentialClear);
      return true;
    } catch (error) {
      logger.error('session.clear-marker-delete-failed', { error: describeError(error) });
      return false;
    }
  };

  const finishCleanup = (cleared: boolean) => {
    if (cleared) {
      recovery = null;
      setAuth({ status: 'unauthenticated', user: null, errorMessage: null });
      return;
    }
    enterRecovery('credentialClear');
  };

  const signOut = async (notice: string | null) => {
    setAuth({ status: 'signingOut', user: null, errorMessage: null, notice });
    invalidate();
    finishCleanup(await clearCredentials());
  };

  // Keychain items survive an uninstall on iOS; a fresh install must not inherit them.
  const runFirstLaunchBootstrap = async (): Promise<boolean> => {
    try {
      await authRepository.clearSession();
      storage.setString(appKeys.installed, '1');
      return true;
    } catch (error) {
      logger.error('session.first-launch-failed', { error: describeError(error) });
      return false;
    }
  };

  const loadWithOneRetry = async (): Promise<LoadSessionResult> => {
    const first = await authRepository.loadStoredSession();
    if (first.kind !== 'error') {
      return first;
    }
    logger.warn('session.load-retry', { error: describeError(first.cause) });
    return authRepository.loadStoredSession();
  };

  const loadAndActivate = async () => {
    const result = await loadWithOneRetry();
    logger.info('session.restore', { result: result.kind });
    if (result.kind === 'none') {
      setAuth({ status: 'unauthenticated' });
      return;
    }
    if (result.kind === 'error') {
      logger.warn('session.load-failed', { error: describeError(result.cause) });
      setAuth({ status: 'unauthenticated', notice: SESSION_READ_FAILED_NOTICE });
      return;
    }
    if (result.kind === 'malformed') {
      finishCleanup(await clearCredentials());
      return;
    }
    const profile = authRepository.readProfile(result.session.userId);
    if (!profile) {
      finishCleanup(await clearCredentials());
      return;
    }
    activate(result.session, profile);
  };

  const restoreSession = async () => {
    if (storage.getString(appKeys.pendingCredentialClear) !== undefined) {
      const cleared = await clearCredentials();
      if (!cleared) {
        enterRecovery('credentialClear');
        return;
      }
    }
    if (storage.getString(appKeys.installed) === undefined) {
      const ready = await runFirstLaunchBootstrap();
      if (!ready) {
        enterRecovery('firstLaunch');
        return;
      }
    }
    await loadAndActivate();
  };

  const runRestore = async () => {
    setAuth({ status: 'restoring' });
    try {
      await restoreSession();
    } catch (error) {
      logger.error('session.restore-crashed', { error: describeError(error) });
      if (status() === 'restoring') {
        setAuth({ status: 'unauthenticated', notice: SESSION_READ_FAILED_NOTICE });
      }
    }
  };

  return {
    restore() {
      // Android recreates the activity (back key, then relaunch) inside a live JS runtime, which remounts
      // the root component. Restoring again would re-activate the stored session under a new epoch and
      // race any request or refresh still in flight for the current one, so restoration runs once.
      if (!restoration) {
        restoration = runRestore();
      }
      return restoration;
    },

    async login(email, password) {
      // Only a settled signed-out state may start a login: during restore, sign-out or a pending
      // credential cleanup, a new session could be overwritten or wiped by the operation in progress.
      if (status() !== 'unauthenticated') {
        return;
      }
      setAuth({ status: 'submitting', errorMessage: null, notice: null });
      try {
        const { session, user } = await authRepository.login(email, password);
        await authRepository.saveSession(session);
        authRepository.writeProfile(user);
        activate(session, user);
      } catch (error) {
        logger.warn('session.login-failed', { error: describeError(error) });
        setAuth({ status: 'unauthenticated', errorMessage: loginErrorMessage(error) });
      }
    },

    async logout() {
      if (status() !== 'authenticated') {
        return;
      }
      await signOut(null);
    },

    async retryCleanup() {
      if (status() !== 'cleanupRequired') {
        return;
      }
      if (recovery === 'firstLaunch') {
        setAuth({ status: 'restoring', errorMessage: null });
        const ready = await runFirstLaunchBootstrap();
        if (!ready) {
          enterRecovery('firstLaunch');
          return;
        }
        recovery = null;
        await loadAndActivate();
        return;
      }
      setAuth({ status: 'signingOut', errorMessage: null });
      finishCleanup(await clearCredentials());
    },

    onSessionExpired(stamp) {
      if (!sessionContext.isCurrent(stamp)) {
        return;
      }
      signOut(SESSION_EXPIRED_NOTICE);
    },

    async onTokensRotated(session, stamp) {
      try {
        await authRepository.saveSession(session, stamp);
      } catch (error) {
        // The server already rotated; keep serving this run in memory and require login next launch.
        logger.error('session.rotation-persist-failed', { error: describeError(error) });
      }
      if (!sessionContext.isCurrent(stamp)) {
        return;
      }
      sessionContext.updateTokens(session);
    },

    start() {
      let previous = connectivity.getStatus();
      return connectivity.subscribe(() => {
        const next = connectivity.getStatus();
        const cameOnline = previous === 'offline' && next === 'online';
        previous = next;
        if (cameOnline && status() === 'authenticated') {
          coursesStore.getState().loadCourses();
        }
      });
    },
  };
}

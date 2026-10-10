import type { AuthApi, LoginResult } from '../../infrastructure/api/authApi';
import type { SessionContext } from '../../infrastructure/secure/sessionContext';
import type { SerialQueue } from '../../infrastructure/secure/serialQueue';
import type { LoadSessionResult, TokenStorage } from '../../infrastructure/secure/TokenStorage';
import { userKeys } from '../../infrastructure/storage/keys';
import type { StorageAdapter } from '../../infrastructure/storage/StorageAdapter';
import { parseJsonSafely } from '../../shared/guards';
import type { Session, SessionStamp, User } from '../../domain/auth/types';
import { isValidUser } from '../../domain/auth/validation';

export type AuthRepository = {
  login(email: string, password: string): Promise<LoginResult>;
  loadStoredSession(): Promise<LoadSessionResult>;
  saveSession(session: Session, stamp?: SessionStamp): Promise<void>;
  clearSession(): Promise<void>;
  readProfile(userId: string): User | null;
  writeProfile(user: User): void;
};

export type AuthRepositoryDeps = {
  authApi: AuthApi;
  tokenStorage: TokenStorage;
  storage: StorageAdapter;
  secureQueue: SerialQueue;
  sessionContext: SessionContext;
};

export function createAuthRepository(deps: AuthRepositoryDeps): AuthRepository {
  const { authApi, tokenStorage, storage, secureQueue, sessionContext } = deps;

  const saveWithOneRetry = async (session: Session): Promise<void> => {
    try {
      await tokenStorage.save(session);
    } catch {
      await tokenStorage.save(session);
    }
  };

  return {
    login: (email, password) => authApi.login(email.trim(), password),
    loadStoredSession: () => tokenStorage.load(),
    saveSession: (session, stamp) =>
      secureQueue.run(async () => {
        // A save queued behind a sign-out must not resurrect the session it belonged to.
        if (stamp && !sessionContext.isCurrent(stamp)) {
          return;
        }
        await saveWithOneRetry(session);
      }),
    clearSession: () => secureQueue.run(() => tokenStorage.clear()),
    readProfile: userId => {
      const raw = storage.getString(userKeys(userId).profile);
      const parsed = raw === undefined ? undefined : parseJsonSafely(raw);
      return isValidUser(parsed) && parsed.id === userId ? parsed : null;
    },
    writeProfile: user => {
      storage.setString(userKeys(user.id).profile, JSON.stringify(user));
    },
  };
}

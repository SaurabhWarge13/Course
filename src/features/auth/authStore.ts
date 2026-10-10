import { create } from 'zustand';
import type { User } from '../../domain/auth/types';

export type AuthStatus =
  | 'restoring'
  | 'unauthenticated'
  | 'submitting'
  | 'authenticated'
  | 'signingOut'
  | 'cleanupRequired';

export type AuthState = {
  status: AuthStatus;
  user: User | null;
  errorMessage: string | null;
  notice: string | null;
};

export type SessionActions = {
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  retryCleanup(): Promise<void>;
};

export function createAuthStore(getActions: () => SessionActions) {
  return create<AuthState & SessionActions>()(() => ({
    status: 'restoring',
    user: null,
    errorMessage: null,
    notice: null,
    login: (email, password) => getActions().login(email, password),
    logout: () => getActions().logout(),
    retryCleanup: () => getActions().retryCleanup(),
  }));
}

export type AuthStore = ReturnType<typeof createAuthStore>;

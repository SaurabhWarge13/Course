import React, { createContext, type ReactNode, useContext } from 'react';
import { useStore } from 'zustand';
import type { AuthState, AuthStore, SessionActions } from './authStore';

// The composition root creates the store and provides it here, so screens depend on this feature
// module only and never on the app layer.
const AuthStoreContext = createContext<AuthStore | null>(null);

type AuthStoreProviderProps = {
  store: AuthStore;
  children: ReactNode;
};

export function AuthStoreProvider({ store, children }: AuthStoreProviderProps) {
  return <AuthStoreContext.Provider value={store}>{children}</AuthStoreContext.Provider>;
}

export function useAuthStoreApi(): AuthStore {
  const store = useContext(AuthStoreContext);
  if (!store) {
    throw new Error('useAuthStore must be used inside an AuthStoreProvider');
  }
  return store;
}

export function useAuthStore<T>(selector: (state: AuthState & SessionActions) => T): T {
  return useStore(useAuthStoreApi(), selector);
}

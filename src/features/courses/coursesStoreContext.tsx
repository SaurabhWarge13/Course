import React, { createContext, type ReactNode, useContext } from 'react';
import { useStore } from 'zustand';
import type { CoursesActions, CoursesState, CoursesStore } from './coursesStore';

// The composition root creates the store and provides it here, so screens depend on this feature
// module only and never on the app layer.
const CoursesStoreContext = createContext<CoursesStore | null>(null);

type CoursesStoreProviderProps = {
  store: CoursesStore;
  children: ReactNode;
};

export function CoursesStoreProvider({ store, children }: CoursesStoreProviderProps) {
  return <CoursesStoreContext.Provider value={store}>{children}</CoursesStoreContext.Provider>;
}

export function useCoursesStoreApi(): CoursesStore {
  const store = useContext(CoursesStoreContext);
  if (!store) {
    throw new Error('useCoursesStore must be used inside a CoursesStoreProvider');
  }
  return store;
}

export function useCoursesStore<T>(selector: (state: CoursesState & CoursesActions) => T): T {
  return useStore(useCoursesStoreApi(), selector);
}

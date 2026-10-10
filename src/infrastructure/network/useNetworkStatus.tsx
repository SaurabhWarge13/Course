import React, { createContext, type ReactNode, useContext, useSyncExternalStore } from 'react';
import type { Connectivity, ConnectivityStatus } from './connectivity';

const ConnectivityContext = createContext<Connectivity | null>(null);

type ConnectivityProviderProps = {
  connectivity: Connectivity;
  children: ReactNode;
};

export function ConnectivityProvider({ connectivity, children }: ConnectivityProviderProps) {
  return <ConnectivityContext.Provider value={connectivity}>{children}</ConnectivityContext.Provider>;
}

function useConnectivity(): Connectivity {
  const connectivity = useContext(ConnectivityContext);
  if (!connectivity) {
    throw new Error('useNetworkStatus must be used inside a ConnectivityProvider');
  }
  return connectivity;
}

// Views read the device connection status directly; requests never trust it (see connectivity.ts).
export function useNetworkStatus(): ConnectivityStatus {
  const connectivity = useConnectivity();
  return useSyncExternalStore(connectivity.subscribe, connectivity.getStatus);
}

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export type ConnectivityStatus = 'online' | 'offline' | 'unknown';

export type Connectivity = {
  getStatus(): ConnectivityStatus;
  subscribe(listener: () => void): () => void;
};

function toStatus(state: NetInfoState): ConnectivityStatus {
  if (state.isConnected === null) {
    return 'unknown';
  }
  return state.isConnected ? 'online' : 'offline';
}

export function createConnectivity(): Connectivity {
  let status: ConnectivityStatus = 'unknown';
  const listeners = new Set<() => void>();

  NetInfo.addEventListener(state => {
    const next = toStatus(state);
    if (next === status) {
      return;
    }
    status = next;
    listeners.forEach(listener => listener());
  });

  return {
    getStatus: () => status,
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

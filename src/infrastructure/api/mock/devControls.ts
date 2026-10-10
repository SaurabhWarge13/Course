import type { MockServerState } from './mockServerState';

export type DevControls = {
  readonly forceServerError: boolean;
  toggleForceServerError(): void;
  expireAccessToken(userId: string): void;
  revokeRefreshToken(userId: string): void;
};

export function createDevControls(state: MockServerState): DevControls {
  let forceServerError = false;
  return {
    get forceServerError() {
      return forceServerError;
    },
    toggleForceServerError: () => {
      forceServerError = !forceServerError;
    },
    expireAccessToken: userId => state.expireAccess(userId),
    revokeRefreshToken: userId => state.revokeRefresh(userId),
  };
}

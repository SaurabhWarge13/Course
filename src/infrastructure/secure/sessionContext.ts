import type { Session, SessionStamp } from '../../domain/auth/types';

export type ActiveSession = SessionStamp & {
  accessToken: string;
  refreshToken: string;
};

export type SessionContext = {
  current(): ActiveSession | null;
  isCurrent(stamp: SessionStamp): boolean;
  set(session: Session, epoch: number): void;
  updateTokens(session: Session): void;
  clear(): void;
};

export function createSessionContext(): SessionContext {
  let active: ActiveSession | null = null;
  return {
    current: () => active,
    isCurrent: stamp =>
      active !== null && active.userId === stamp.userId && active.epoch === stamp.epoch,
    set: (session, epoch) => {
      active = {
        userId: session.userId,
        epoch,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      };
    },
    updateTokens: session => {
      if (active && active.userId === session.userId) {
        active = { ...active, accessToken: session.accessToken, refreshToken: session.refreshToken };
      }
    },
    clear: () => {
      active = null;
    },
  };
}

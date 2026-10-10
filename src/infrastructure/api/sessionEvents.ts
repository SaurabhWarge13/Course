import type { Session, SessionStamp } from '../../domain/auth/types';
import { AppError } from './errors';

export type SessionEventHandlers = {
  onTokensRotated(session: Session, stamp: SessionStamp): Promise<void>;
  onSessionExpired(stamp: SessionStamp): void;
};

export type SessionEvents = SessionEventHandlers & {
  bind(handlers: SessionEventHandlers): void;
};

export function createSessionEvents(): SessionEvents {
  let handlers: SessionEventHandlers | null = null;
  const requireHandlers = (): SessionEventHandlers => {
    if (!handlers) {
      throw new AppError('unknown', 'Session events are not bound');
    }
    return handlers;
  };
  return {
    bind: next => {
      handlers = next;
    },
    onTokensRotated: (session, stamp) => requireHandlers().onTokensRotated(session, stamp),
    onSessionExpired: stamp => requireHandlers().onSessionExpired(stamp),
  };
}

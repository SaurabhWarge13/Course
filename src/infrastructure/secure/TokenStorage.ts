import type { Session } from '../../domain/auth/types';

export type LoadSessionResult =
  | { kind: 'none' }
  | { kind: 'session'; session: Session }
  | { kind: 'malformed' }
  | { kind: 'error'; cause: unknown };

export type TokenStorage = {
  load(): Promise<LoadSessionResult>;
  save(session: Session): Promise<void>;
  clear(): Promise<void>;
};

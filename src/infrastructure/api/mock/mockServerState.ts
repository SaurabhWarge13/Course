import { isRecord, parseJsonSafely } from '../../../shared/guards';
import type { StorageAdapter } from '../../storage/StorageAdapter';
import { SEED_COURSES, seededCompletedIds } from './mockData';

export type MockSession = {
  refreshToken: string;
  accessToken: string;
  userId: string;
  accessExpiresAt: number;
  revoked: boolean;
};

type MockState = {
  sessions: Record<string, MockSession>;
  progress: Record<string, Record<string, number[]>>;
};

export type MockServerState = {
  issueSession(userId: string): MockSession;
  findValidByAccessToken(accessToken: string): MockSession | null;
  rotate(refreshToken: string): MockSession | null;
  expireAccess(userId: string): void;
  revokeRefresh(userId: string): void;
  ensureSeededProgress(userId: string): void;
  completedIds(userId: string, courseId: number): Set<number>;
  markCompleted(userId: string, courseId: number, lessonId: number): void;
};

type MockServerOptions = {
  accessTokenTtlMs: number;
  now?: () => number;
};

const STATE_KEY = 'state';

function randomToken(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function loadState(storage: StorageAdapter): MockState {
  const raw = storage.getString(STATE_KEY);
  const parsed = raw === undefined ? undefined : parseJsonSafely(raw);
  if (isRecord(parsed) && isRecord(parsed.sessions) && isRecord(parsed.progress)) {
    return parsed as MockState;
  }
  return { sessions: {}, progress: {} };
}

export function createMockServerState(
  storage: StorageAdapter,
  options: MockServerOptions,
): MockServerState {
  const now = options.now ?? Date.now;
  const state = loadState(storage);
  const persist = () => storage.setString(STATE_KEY, JSON.stringify(state));

  const sessionsOf = (userId: string) =>
    Object.values(state.sessions).filter(session => session.userId === userId);

  const issueSession = (userId: string): MockSession => {
    const session: MockSession = {
      refreshToken: randomToken('ref'),
      accessToken: randomToken('acc'),
      userId,
      accessExpiresAt: now() + options.accessTokenTtlMs,
      revoked: false,
    };
    state.sessions[session.refreshToken] = session;
    persist();
    return session;
  };

  return {
    issueSession,
    findValidByAccessToken(accessToken) {
      const session = Object.values(state.sessions).find(
        candidate => candidate.accessToken === accessToken,
      );
      if (!session || session.revoked || session.accessExpiresAt <= now()) {
        return null;
      }
      return session;
    },
    rotate(refreshToken) {
      const session = state.sessions[refreshToken];
      if (!session || session.revoked) {
        return null;
      }
      delete state.sessions[refreshToken];
      return issueSession(session.userId);
    },
    expireAccess(userId) {
      sessionsOf(userId).forEach(session => {
        session.accessExpiresAt = 0;
      });
      persist();
    },
    revokeRefresh(userId) {
      sessionsOf(userId).forEach(session => {
        session.revoked = true;
      });
      persist();
    },
    ensureSeededProgress(userId) {
      const userProgress = (state.progress[userId] ??= {});
      let changed = false;
      SEED_COURSES.forEach(course => {
        if (!userProgress[course.id]) {
          userProgress[course.id] = seededCompletedIds(course);
          changed = true;
        }
      });
      if (changed) {
        persist();
      }
    },
    completedIds(userId, courseId) {
      return new Set(state.progress[userId]?.[courseId] ?? []);
    },
    markCompleted(userId, courseId, lessonId) {
      const userProgress = (state.progress[userId] ??= {});
      const ids = (userProgress[courseId] ??= []);
      if (!ids.includes(lessonId)) {
        ids.push(lessonId);
        persist();
      }
    },
  };
}

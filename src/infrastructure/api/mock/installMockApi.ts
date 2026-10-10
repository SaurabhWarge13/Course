import { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { calculateProgress } from '../../../domain/courses/progress';
import { isRecord, parseJsonSafely } from '../../../shared/guards';
import type { Connectivity } from '../../network/connectivity';
import type { DevControls } from './devControls';
import { SEED_COURSES, buildMockLessons } from './mockData';
import type { MockServerState } from './mockServerState';

type MockReply = [number, unknown];

export type MockApiOptions = {
  authClient: AxiosInstance;
  protectedClient: AxiosInstance;
  state: MockServerState;
  connectivity: Connectivity;
  devControls: DevControls;
  latencyMs: number;
  accessTokenTtlMs: number;
};

const DEMO_PASSWORD = 'Password@123';
const EMPTY_COURSES_EMAIL = 'empty@test.com';
const LESSONS_ROUTE = /\/courses\/(\d+)\/lessons$/;
const LESSON_ROUTE = /\/courses\/(\d+)\/lessons\/(\d+)$/;

function displayName(email: string): string {
  const localPart = email.split('@')[0].replace(/[._-]+/g, ' ');
  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}

function readBody(config: AxiosRequestConfig): Record<string, unknown> {
  const parsed = typeof config.data === 'string' ? parseJsonSafely(config.data) : config.data;
  return isRecord(parsed) ? parsed : {};
}

function routeNumbers(config: AxiosRequestConfig, route: RegExp): number[] {
  const match = route.exec(config.url ?? '');
  return match ? match.slice(1).map(Number) : [];
}

export function installMockApi(options: MockApiOptions): void {
  const { state, connectivity, devControls } = options;

  const transportFailure = (): MockReply | null => {
    if (connectivity.getStatus() === 'offline') {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK);
    }
    return devControls.forceServerError ? [500, { message: 'Simulated server error' }] : null;
  };

  const tokenResponse = (userId: string, email?: string): Record<string, unknown> => {
    const session = state.issueSession(userId);
    const body: Record<string, unknown> = {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresIn: options.accessTokenTtlMs / 1000,
    };
    if (email) {
      body.user = { id: userId, email, name: displayName(email) };
    }
    return body;
  };

  const auth = new MockAdapter(options.authClient, { delayResponse: options.latencyMs });

  auth.onPost('/auth/login').reply((config): MockReply => {
    const failure = transportFailure();
    if (failure) {
      return failure;
    }
    const { email, password } = readBody(config);
    if (typeof email !== 'string' || !email.includes('@') || password !== DEMO_PASSWORD) {
      return [401, { message: 'Invalid email or password' }];
    }
    const userId = email.trim().toLowerCase();
    state.ensureSeededProgress(userId);
    return [200, tokenResponse(userId, userId)];
  });

  auth.onPost('/auth/refresh').reply((config): MockReply => {
    const failure = transportFailure();
    if (failure) {
      return failure;
    }
    const { refreshToken } = readBody(config);
    const rotated = typeof refreshToken === 'string' ? state.rotate(refreshToken) : null;
    if (!rotated) {
      return [401, { message: 'Refresh token is invalid' }];
    }
    return [
      200,
      {
        accessToken: rotated.accessToken,
        refreshToken: rotated.refreshToken,
        expiresIn: options.accessTokenTtlMs / 1000,
      },
    ];
  });

  const protectedMock = new MockAdapter(options.protectedClient, {
    delayResponse: options.latencyMs,
  });

  const withSession = (
    config: AxiosRequestConfig,
    handler: (userId: string) => MockReply,
  ): MockReply => {
    const failure = transportFailure();
    if (failure) {
      return failure;
    }
    const header = String(config.headers?.Authorization ?? '');
    const session = header.startsWith('Bearer ')
      ? state.findValidByAccessToken(header.slice('Bearer '.length))
      : null;
    if (!session) {
      return [401, { message: 'Unauthorized' }];
    }
    return handler(session.userId);
  };

  protectedMock.onGet('/courses').reply(config =>
    withSession(config, userId => {
      if (userId === EMPTY_COURSES_EMAIL) {
        return [200, []];
      }
      const courses = SEED_COURSES.map(course => ({
        ...course,
        progress: calculateProgress(buildMockLessons(course, state.completedIds(userId, course.id))),
      }));
      return [200, courses];
    }),
  );

  protectedMock.onGet(LESSONS_ROUTE).reply(config =>
    withSession(config, userId => {
      const [courseId] = routeNumbers(config, LESSONS_ROUTE);
      const course = SEED_COURSES.find(candidate => candidate.id === courseId);
      if (!course) {
        return [404, { message: 'Course not found' }];
      }
      return [200, buildMockLessons(course, state.completedIds(userId, course.id))];
    }),
  );

  protectedMock.onPatch(LESSON_ROUTE).reply(config =>
    withSession(config, userId => {
      const [courseId, lessonId] = routeNumbers(config, LESSON_ROUTE);
      const course = SEED_COURSES.find(candidate => candidate.id === courseId);
      const lessons = course ? buildMockLessons(course, state.completedIds(userId, course.id)) : [];
      if (!course || !lessons.some(lesson => lesson.id === lessonId)) {
        return [404, { message: 'Lesson not found' }];
      }
      state.markCompleted(userId, courseId, lessonId);
      const progress = calculateProgress(buildMockLessons(course, state.completedIds(userId, courseId)));
      return [200, { courseId, lessonId, completed: true, progress }];
    }),
  );
}

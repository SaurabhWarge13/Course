import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type { Session, SessionStamp } from '../../domain/auth/types';
import type { SessionContext } from '../secure/sessionContext';
import type { HttpClientOptions } from './createAuthClient';
import { normalizeError, unauthorizedError } from './errors';
import type { SessionEvents } from './sessionEvents';

type RequestMeta = SessionStamp & {
  tokenUsed: string;
  retried: boolean;
};

declare module 'axios' {
  export interface AxiosRequestConfig {
    meta?: RequestMeta;
  }
}

type RefreshFlight = SessionStamp & { promise: Promise<void> };

export type ProtectedClientOptions = HttpClientOptions & {
  sessionContext: SessionContext;
  sessionEvents: SessionEvents;
  refreshSession: (refreshToken: string, userId: string) => Promise<Session>;
};

export function createProtectedClient(options: ProtectedClientOptions): AxiosInstance {
  const { sessionContext, sessionEvents, refreshSession } = options;
  const client = axios.create({ baseURL: options.baseUrl, timeout: options.timeoutMs });
  let flight: RefreshFlight | null = null;

  client.interceptors.request.use(config => {
    const active = sessionContext.current();
    if (!active) {
      throw unauthorizedError('No active session');
    }
    // Metadata is created once per original request so a retry keeps its stamp and retry flag.
    if (!config.meta) {
      config.meta = {
        userId: active.userId,
        epoch: active.epoch,
        tokenUsed: active.accessToken,
        retried: false,
      };
    }
    config.headers.Authorization = `Bearer ${config.meta.tokenUsed}`;
    return config;
  });

  const resend = (config: InternalAxiosRequestConfig, meta: RequestMeta, accessToken: string) =>
    client({ ...config, meta: { ...meta, tokenUsed: accessToken, retried: true } });

  // One refresh per session: requests with the same user and epoch share it; any other session starts its own.
  const getOrStartFlight = (stamp: SessionStamp, refreshToken: string): RefreshFlight => {
    if (flight && flight.userId === stamp.userId && flight.epoch === stamp.epoch) {
      return flight;
    }
    const next: RefreshFlight = { userId: stamp.userId, epoch: stamp.epoch, promise: Promise.resolve() };
    next.promise = (async () => {
      const session = await refreshSession(refreshToken, stamp.userId);
      await sessionEvents.onTokensRotated(session, stamp);
    })().finally(() => {
      if (flight === next) {
        flight = null;
      }
    });
    flight = next;
    return next;
  };

  client.interceptors.response.use(
    response => response,
    async (error: unknown) => {
      if (!axios.isAxiosError(error) || error.response?.status !== 401) {
        throw normalizeError(error);
      }
      const config = error.config;
      const meta = config?.meta;
      if (!config || !meta) {
        throw normalizeError(error);
      }
      if (!sessionContext.isCurrent(meta)) {
        throw unauthorizedError('Session changed');
      }
      if (meta.retried) {
        sessionEvents.onSessionExpired(meta);
        throw unauthorizedError();
      }
      const active = sessionContext.current();
      if (!active) {
        throw unauthorizedError();
      }
      if (active.accessToken !== meta.tokenUsed) {
        return resend(config, meta, active.accessToken);
      }
      try {
        await getOrStartFlight(meta, active.refreshToken).promise;
      } catch (refreshError) {
        const normalized = normalizeError(refreshError);
        if (normalized.kind === 'unauthorized') {
          sessionEvents.onSessionExpired(meta);
        }
        throw normalized;
      }
      const refreshed = sessionContext.current();
      if (!refreshed || !sessionContext.isCurrent(meta)) {
        throw unauthorizedError('Session changed');
      }
      return resend(config, meta, refreshed.accessToken);
    },
  );

  return client;
}

import type { AxiosInstance } from 'axios';
import type { Session, User } from '../../domain/auth/types';
import { isValidUser } from '../../domain/auth/validation';
import { isFiniteNumber, isNonEmptyString, isRecord } from '../../shared/guards';
import { protocolError } from './errors';

export type LoginResult = {
  session: Session;
  user: User;
};

export type AuthApi = {
  login(email: string, password: string): Promise<LoginResult>;
  refresh(refreshToken: string, userId: string): Promise<Session>;
};

export function createAuthApi(client: AxiosInstance, now: () => number = Date.now): AuthApi {
  const toSession = (data: unknown, userId: string): Session => {
    if (
      !isRecord(data) ||
      !isNonEmptyString(data.accessToken) ||
      !isNonEmptyString(data.refreshToken) ||
      !isFiniteNumber(data.expiresIn) ||
      data.expiresIn <= 0
    ) {
      throw protocolError('Malformed token response');
    }
    return {
      userId,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      accessTokenExpiresAt: now() + data.expiresIn * 1000,
    };
  };

  return {
    async login(email, password) {
      const { data } = await client.post<unknown>('/auth/login', { email, password });
      if (!isRecord(data) || !isValidUser(data.user)) {
        throw protocolError('Malformed login response');
      }
      return { session: toSession(data, data.user.id), user: data.user };
    },
    async refresh(refreshToken, userId) {
      const { data } = await client.post<unknown>('/auth/refresh', { refreshToken });
      return toSession(data, userId);
    },
  };
}

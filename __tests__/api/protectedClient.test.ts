import type { AxiosRequestConfig } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import type { Session, SessionStamp } from '../../src/domain/auth/types';
import { createAuthClient } from '../../src/infrastructure/api/createAuthClient';
import { createProtectedClient } from '../../src/infrastructure/api/createProtectedClient';
import { AppError } from '../../src/infrastructure/api/errors';
import { createSessionEvents } from '../../src/infrastructure/api/sessionEvents';
import { createSessionContext } from '../../src/infrastructure/secure/sessionContext';
import { deferred } from '../fakes/deferred';
import { alice, bob, sessionFor } from '../fakes/fixtures';

const BASE = { baseUrl: 'https://api.test', timeoutMs: 1000 };

function rotatedSession(userId: string, suffix = 'new'): Session {
  return {
    userId,
    accessToken: `acc_${userId}_${suffix}`,
    refreshToken: `ref_${userId}_${suffix}`,
    accessTokenExpiresAt: Date.now() + 60_000,
  };
}

function bearer(config: AxiosRequestConfig): string {
  return String(config.headers?.Authorization ?? '');
}

async function untilCalled(fn: jest.Mock, times: number): Promise<void> {
  for (let attempt = 0; attempt < 50 && fn.mock.calls.length < times; attempt += 1) {
    await new Promise<void>(resolve => setTimeout(() => resolve(), 2));
  }
}

function setup() {
  const sessionContext = createSessionContext();
  sessionContext.set(sessionFor(alice), 1);
  const sessionEvents = createSessionEvents();
  const expired: SessionStamp[] = [];
  const persist = jest.fn<Promise<void>, [Session, SessionStamp]>().mockResolvedValue(undefined);
  sessionEvents.bind({
    onTokensRotated: async (session, stamp) => {
      await persist(session, stamp);
      if (sessionContext.isCurrent(stamp)) {
        sessionContext.updateTokens(session);
      }
    },
    onSessionExpired: stamp => {
      if (sessionContext.isCurrent(stamp)) {
        expired.push({ userId: stamp.userId, epoch: stamp.epoch });
        sessionContext.clear();
      }
    },
  });
  const refreshSession = jest.fn<Promise<Session>, [string, string]>((_token, userId) =>
    Promise.resolve(rotatedSession(userId)),
  );
  const client = createProtectedClient({ ...BASE, sessionContext, sessionEvents, refreshSession });
  const mock = new MockAdapter(client);
  return { client, mock, sessionContext, refreshSession, persist, expired };
}

const aliceOld = `Bearer ${sessionFor(alice).accessToken}`;
const aliceNew = `Bearer ${rotatedSession(alice.id).accessToken}`;

describe('protected client refresh handling', () => {
  it('refreshes once after a 401 and retries the request with the new token', async () => {
    const { client, mock, refreshSession, persist } = setup();
    mock.onGet('/courses').reply(config => (bearer(config) === aliceNew ? [200, ['ok']] : [401]));

    const response = await client.get('/courses');

    expect(response.data).toEqual(['ok']);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(mock.history.get).toHaveLength(2);
    expect(mock.history.get[0].meta).toMatchObject({ retried: false, tokenUsed: sessionFor(alice).accessToken });
    expect(mock.history.get[1].meta).toMatchObject({ retried: true, userId: alice.id, epoch: 1 });
    expect(bearer(mock.history.get[1])).toBe(aliceNew);
  });

  it('shares one refresh between concurrent 401s and retries each request once', async () => {
    const { client, mock, refreshSession } = setup();
    ['/a', '/b', '/c'].forEach(url =>
      mock.onGet(url).reply(config => (bearer(config) === aliceNew ? [200, url] : [401])),
    );

    const results = await Promise.all([client.get('/a'), client.get('/b'), client.get('/c')]);

    expect(results.map(result => result.data)).toEqual(['/a', '/b', '/c']);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(mock.history.get).toHaveLength(6);
    expect(mock.history.get.filter(request => request.meta?.retried)).toHaveLength(3);
  });

  it('retries a late 401 with the already rotated token instead of refreshing again', async () => {
    const { client, mock, sessionContext, refreshSession } = setup();
    const rotated = rotatedSession(alice.id, 'rotated');
    mock.onGet('/late').reply(config => {
      if (bearer(config) === aliceOld) {
        sessionContext.updateTokens(rotated);
        return [401];
      }
      return [200, 'late-ok'];
    });

    const response = await client.get('/late');

    expect(response.data).toBe('late-ok');
    expect(refreshSession).not.toHaveBeenCalled();
    expect(bearer(mock.history.get[1])).toBe(`Bearer ${rotated.accessToken}`);
  });

  it('rejects a request from a previous session without retrying it', async () => {
    const { client, mock, sessionContext, refreshSession } = setup();
    mock.onGet('/stale').reply(() => {
      sessionContext.set(sessionFor(bob), 2);
      return [401];
    });

    await expect(client.get('/stale')).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(refreshSession).not.toHaveBeenCalled();
    expect(mock.history.get).toHaveLength(1);
  });

  it('expires the session once when the retried request is rejected again', async () => {
    const { client, mock, expired, refreshSession } = setup();
    mock.onGet('/always-401').reply(401);

    await expect(client.get('/always-401')).rejects.toMatchObject({ kind: 'unauthorized' });

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(mock.history.get).toHaveLength(2);
    expect(mock.history.get[1].meta?.retried).toBe(true);
    expect(expired).toEqual([{ userId: alice.id, epoch: 1 }]);
  });

  it('expires the session once when the refresh credential is invalid', async () => {
    const { client, mock, expired, refreshSession, sessionContext } = setup();
    refreshSession.mockRejectedValue(new AppError('unauthorized', 'revoked'));
    mock.onGet('/x').reply(401);
    mock.onGet('/y').reply(401);

    const results = await Promise.allSettled([client.get('/x'), client.get('/y')]);

    expect(results.every(result => result.status === 'rejected')).toBe(true);
    expect(expired).toEqual([{ userId: alice.id, epoch: 1 }]);
    expect(sessionContext.current()).toBeNull();
  });

  it('preserves the session when the refresh fails for transient reasons', async () => {
    const { client, mock, expired, refreshSession, sessionContext } = setup();
    refreshSession.mockRejectedValueOnce(new AppError('network', 'timeout'));
    mock.onGet('/x').reply(401);

    await expect(client.get('/x')).rejects.toMatchObject({ kind: 'network' });
    expect(expired).toHaveLength(0);
    expect(sessionContext.current()).toMatchObject({ userId: alice.id, epoch: 1 });

    refreshSession.mockRejectedValueOnce(new AppError('http', 'busy', 503));
    await expect(client.get('/x')).rejects.toMatchObject({ kind: 'http', status: 503 });
    expect(sessionContext.current()).not.toBeNull();
  });

  it('never lets another session join or inherit a refresh in flight', async () => {
    const { client, mock, sessionContext, refreshSession, persist } = setup();
    const aliceRefresh = deferred<Session>();
    refreshSession.mockImplementationOnce(() => aliceRefresh.promise);
    const bobNew = `Bearer ${rotatedSession(bob.id).accessToken}`;
    mock.onGet('/alice').reply(config => (bearer(config) === aliceOld ? [401] : [200, 'alice']));
    mock.onGet('/bob').reply(config => (bearer(config) === bobNew ? [200, 'bob'] : [401]));

    const aliceRequest = client.get('/alice');
    aliceRequest.catch(() => undefined);
    await untilCalled(refreshSession, 1);

    sessionContext.set(sessionFor(bob), 2);
    await expect(client.get('/bob')).resolves.toMatchObject({ data: 'bob' });
    expect(refreshSession).toHaveBeenCalledTimes(2);
    expect(refreshSession.mock.calls[1][1]).toBe(bob.id);

    aliceRefresh.resolve(rotatedSession(alice.id));
    await expect(aliceRequest).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ userId: alice.id }), expect.objectContaining({ userId: alice.id, epoch: 1 }));
    expect(sessionContext.current()?.accessToken).toBe(rotatedSession(bob.id).accessToken);
  });

  it('clears a failed flight so the next 401 can refresh again', async () => {
    const { client, mock, persist, refreshSession } = setup();
    persist.mockRejectedValueOnce(new Error('keychain down'));
    mock.onGet('/x').reply(config => (bearer(config) === aliceNew ? [200, 'ok'] : [401]));

    await expect(client.get('/x')).rejects.toMatchObject({ kind: 'unknown' });
    await expect(client.get('/x')).resolves.toMatchObject({ data: 'ok' });
    expect(refreshSession).toHaveBeenCalledTimes(2);
  });

  it('rejects before sending when there is no active session', async () => {
    const { client, mock, sessionContext } = setup();
    sessionContext.clear();
    mock.onGet('/x').reply(200);
    await expect(client.get('/x')).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(mock.history.get).toHaveLength(0);
  });
});

describe('auth client', () => {
  it('returns a 401 as an unauthorized error without any refresh logic', async () => {
    const client = createAuthClient(BASE);
    const mock = new MockAdapter(client);
    mock.onPost('/auth/login').reply(401, { message: 'Invalid email or password' });

    await expect(client.post('/auth/login', {})).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(mock.history.post).toHaveLength(1);
  });
});

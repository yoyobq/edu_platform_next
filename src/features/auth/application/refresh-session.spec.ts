import { afterEach, describe, expect, it, vi } from 'vitest';

import { ensureFreshSession } from './ensure-fresh-session';
import type { AuthPorts } from './ports';
import { refreshSession } from './refresh-session';
import { setAuthenticatedSession, setUnauthenticatedSession } from './session-store';
import type { AuthSessionSnapshot } from './types';

function buildSessionSnapshot(overrides: Partial<AuthSessionSnapshot> = {}): AuthSessionSnapshot {
  return {
    accessToken: 'current-access-token',
    account: {
      id: 9527,
      identityHint: 'ADMIN',
      loginEmail: 'admin@example.com',
      loginName: 'admin-user',
      status: 'ACTIVE',
    },
    accountId: 9527,
    displayName: 'admin-user',
    identity: null,
    isAuthenticated: true,
    needsProfileCompletion: false,
    primaryAccessGroup: 'ADMIN',
    refreshToken: 'current-refresh-token',
    slotGroup: [],
    userInfo: {
      accessGroup: ['ADMIN'],
      avatarUrl: null,
      email: 'admin@example.com',
      nickname: 'admin-user',
    },
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, reject, resolve };
}

describe('auth refresh locking', () => {
  afterEach(() => {
    setUnauthenticatedSession();
  });

  it('reuses the same in-flight refresh across direct and forced refresh callers', async () => {
    const currentSession = buildSessionSnapshot();
    const refreshedSession = buildSessionSnapshot({
      accessToken: 'refreshed-access-token',
      refreshToken: 'refreshed-refresh-token',
    });
    const deferredRefresh = createDeferred<AuthSessionSnapshot>();
    const storage = {
      clearSession: vi.fn(),
      readSession: vi.fn(() => currentSession),
      writeSession: vi.fn(),
    };
    const ports: AuthPorts = {
      api: {
        login: vi.fn(),
        refresh: vi.fn(() => deferredRefresh.promise),
        restore: vi.fn(),
      },
      storage,
    };

    setAuthenticatedSession(currentSession);

    const directRefreshPromise = refreshSession(ports);
    const forcedRefreshPromise = ensureFreshSession(ports, { force: true });

    expect(ports.api.refresh).toHaveBeenCalledTimes(1);
    expect(ports.api.refresh).toHaveBeenCalledWith({
      refreshToken: currentSession.refreshToken,
    });

    deferredRefresh.resolve(refreshedSession);

    await expect(directRefreshPromise).resolves.toEqual(refreshedSession);
    await expect(forcedRefreshPromise).resolves.toEqual(refreshedSession);
    expect(storage.writeSession).toHaveBeenCalledTimes(1);
    expect(storage.writeSession).toHaveBeenCalledWith(refreshedSession);
  });
});

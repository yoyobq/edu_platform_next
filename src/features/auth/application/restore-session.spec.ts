import { afterEach, describe, expect, it, vi } from 'vitest';

import { GraphQLIngressError } from '@/shared/graphql';

import type { AuthPorts } from './ports';
import { restoreSession } from './restore-session';
import {
  getAuthSessionSnapshot,
  getAuthSessionState,
  getCurrentAuthSession,
  setHydratingSession,
  setUnauthenticatedSession,
} from './session-store';
import type { AuthPendingSession, AuthSessionSnapshot, AuthStoredSession } from './types';

function buildPendingSession(overrides: Partial<AuthPendingSession> = {}): AuthPendingSession {
  return {
    accessToken: 'pending-access-token',
    kind: 'PENDING',
    refreshToken: 'pending-refresh-token',
    ...overrides,
  };
}

function buildSessionSnapshot(overrides: Partial<AuthSessionSnapshot> = {}): AuthSessionSnapshot {
  return {
    accessToken: 'current-access-token',
    account: {
      id: 9527,
      identityHint: 'STAFF',
      loginEmail: 'staff@example.com',
      loginName: 'staff-user',
      status: 'ACTIVE',
    },
    accountId: 9527,
    displayName: 'staff-user',
    identity: {
      departmentId: null,
      id: '3664',
      kind: 'STAFF',
      name: 'staff-user',
      slotGroup: [],
    },
    isAuthenticated: true,
    needsProfileCompletion: false,
    primaryAccessGroup: 'STAFF',
    refreshToken: 'current-refresh-token',
    slotGroup: [],
    userInfo: {
      accessGroup: ['STAFF'],
      avatarUrl: null,
      email: 'staff@example.com',
      nickname: 'staff-user',
      signature: null,
      tags: [],
    },
    ...overrides,
  };
}

function createPorts(input: {
  restoredSession: AuthSessionSnapshot;
  storedSession: AuthStoredSession;
}): AuthPorts {
  return {
    api: {
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      restore: vi.fn(async () => input.restoredSession),
    },
    storage: {
      clearSession: vi.fn(),
      readSession: vi.fn(() => input.storedSession),
      writeSession: vi.fn(),
    },
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

describe('restoreSession pending hydration', () => {
  afterEach(() => {
    setUnauthenticatedSession();
  });

  it('returns null for pending sessions by default while restoring in the background', async () => {
    const pendingSession = buildPendingSession();
    const restoredSession = buildSessionSnapshot();
    const ports = createPorts({ restoredSession, storedSession: pendingSession });

    await expect(restoreSession(ports)).resolves.toBeNull();
    expect(ports.api.restore).toHaveBeenCalledWith(pendingSession);
    await vi.waitFor(() => {
      expect(ports.storage.writeSession).toHaveBeenCalledWith(restoredSession);
    });
  });

  it('waits for pending sessions when requested', async () => {
    const restoredSession = buildSessionSnapshot();
    const ports = createPorts({
      restoredSession,
      storedSession: buildPendingSession(),
    });

    await expect(restoreSession(ports, { waitForPending: true })).resolves.toEqual(restoredSession);
    expect(ports.storage.writeSession).toHaveBeenCalledWith(restoredSession);
  });

  it('persists rotated tokens when access-token restore falls back to refresh', async () => {
    const expiredSession = buildSessionSnapshot({
      accessToken: 'expired-access-token',
      displayName: 'stale-staff-user',
      refreshToken: 'old-refresh-token',
    });
    const pendingSession = buildPendingSession();
    const retainedSession = {
      ...expiredSession,
      accessToken: pendingSession.accessToken,
      refreshToken: pendingSession.refreshToken,
    };
    const restoredSession = buildSessionSnapshot({
      accessToken: pendingSession.accessToken,
      refreshToken: pendingSession.refreshToken,
    });
    const storage = {
      clearSession: vi.fn(),
      readSession: vi.fn(() => expiredSession),
      writeSession: vi.fn(),
    };
    const ports: AuthPorts = {
      api: {
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(async () => pendingSession),
        restore: vi.fn((session) => {
          if (session.accessToken === expiredSession.accessToken) {
            throw new GraphQLIngressError({
              message: 'Access token expired',
              type: 'auth',
            });
          }

          return Promise.resolve(restoredSession);
        }),
      },
      storage,
    };

    await expect(restoreSession(ports, { waitForPending: true })).resolves.toEqual(restoredSession);

    expect(ports.api.refresh).toHaveBeenCalledWith({
      refreshToken: expiredSession.refreshToken,
    });
    expect(storage.writeSession).toHaveBeenNthCalledWith(1, retainedSession);
    expect(storage.writeSession).toHaveBeenNthCalledWith(2, restoredSession);
    expect(getAuthSessionSnapshot()).toEqual(restoredSession);
  });

  it('keeps the stored snapshot when startup restore fails with a transient ingress error', async () => {
    const storedSession = buildSessionSnapshot();
    const ports: AuthPorts = {
      api: {
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(),
        restore: vi.fn(async () => {
          throw new GraphQLIngressError({
            message: 'Failed to fetch',
            type: 'network',
          });
        }),
      },
      storage: {
        clearSession: vi.fn(),
        readSession: vi.fn(() => storedSession),
        writeSession: vi.fn(),
      },
    };

    await expect(restoreSession(ports, { waitForPending: true })).resolves.toEqual(storedSession);

    expect(ports.storage.clearSession).not.toHaveBeenCalled();
    expect(getAuthSessionState().status).toBe('authenticated');
    expect(getAuthSessionSnapshot()).toEqual(storedSession);
  });

  it('clears refreshed pending tokens when hydrate after refresh fails with auth', async () => {
    const expiredSession = buildSessionSnapshot({
      accessToken: 'expired-access-token',
      refreshToken: 'old-refresh-token',
    });
    const pendingSession = buildPendingSession();
    const retainedSession = {
      ...expiredSession,
      accessToken: pendingSession.accessToken,
      refreshToken: pendingSession.refreshToken,
    };
    let storedSession: AuthStoredSession | null = expiredSession;
    const ports: AuthPorts = {
      api: {
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(async () => pendingSession),
        restore: vi.fn((session) => {
          if (session.accessToken === expiredSession.accessToken) {
            throw new GraphQLIngressError({
              message: 'Access token expired',
              type: 'auth',
            });
          }

          throw new GraphQLIngressError({
            message: 'Refreshed token rejected',
            type: 'auth',
          });
        }),
      },
      storage: {
        clearSession: vi.fn(() => {
          storedSession = null;
        }),
        readSession: vi.fn(() => storedSession),
        writeSession: vi.fn((session) => {
          storedSession = session;
        }),
      },
    };

    await expect(restoreSession(ports, { waitForPending: true })).resolves.toBeNull();

    expect(ports.storage.writeSession).toHaveBeenCalledWith(retainedSession);
    expect(ports.storage.clearSession).toHaveBeenCalledTimes(1);
    expect(getAuthSessionState().status).toBe('unauthenticated');
    expect(getCurrentAuthSession()).toBeNull();
  });

  it('keeps refreshed tokens with the previous snapshot when hydrate after refresh is transient', async () => {
    const expiredSession = buildSessionSnapshot({
      accessToken: 'expired-access-token',
      refreshToken: 'old-refresh-token',
    });
    const pendingSession = buildPendingSession({
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
    });
    const retainedSession = {
      ...expiredSession,
      accessToken: pendingSession.accessToken,
      refreshToken: pendingSession.refreshToken,
    };
    const ports: AuthPorts = {
      api: {
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(async () => pendingSession),
        restore: vi.fn((session) => {
          if (session.accessToken === expiredSession.accessToken) {
            throw new GraphQLIngressError({
              message: 'Access token expired',
              type: 'auth',
            });
          }

          throw new GraphQLIngressError({
            message: 'Service unavailable',
            type: 'http',
          });
        }),
      },
      storage: {
        clearSession: vi.fn(),
        readSession: vi.fn(() => expiredSession),
        writeSession: vi.fn(),
      },
    };

    await expect(restoreSession(ports, { waitForPending: true })).resolves.toEqual(retainedSession);

    expect(ports.storage.writeSession).toHaveBeenCalledTimes(1);
    expect(ports.storage.writeSession).toHaveBeenNthCalledWith(1, retainedSession);
    expect(ports.storage.clearSession).not.toHaveBeenCalled();
    expect(getAuthSessionState().status).toBe('authenticated');
    expect(getAuthSessionSnapshot()).toEqual(retainedSession);
  });

  it('starts a newer pending restore while an older restore is still in flight', async () => {
    const oldSession = buildSessionSnapshot({
      accessToken: 'old-staff-access-token',
      refreshToken: 'old-staff-refresh-token',
    });
    const newPendingSession = buildPendingSession({
      accessToken: 'new-student-access-token',
      refreshToken: 'new-student-refresh-token',
    });
    const restoredNewSession = buildSessionSnapshot({
      accessToken: newPendingSession.accessToken,
      refreshToken: newPendingSession.refreshToken,
    });
    const oldRestore = createDeferred<AuthSessionSnapshot>();
    let storedSession: AuthStoredSession = oldSession;
    const ports: AuthPorts = {
      api: {
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(),
        restore: vi.fn((session) => {
          if (session.accessToken === oldSession.accessToken) {
            return oldRestore.promise;
          }

          if (session.accessToken === newPendingSession.accessToken) {
            return Promise.resolve(restoredNewSession);
          }

          throw new Error('Unexpected restore session');
        }),
      },
      storage: {
        clearSession: vi.fn(),
        readSession: vi.fn(() => storedSession),
        writeSession: vi.fn((session) => {
          storedSession = session;
        }),
      },
    };

    const oldRestorePromise = restoreSession(ports);

    await vi.waitFor(() => {
      expect(ports.api.restore).toHaveBeenCalledWith(oldSession);
    });

    storedSession = newPendingSession;
    setHydratingSession(newPendingSession);

    await expect(restoreSession(ports, { waitForPending: true })).resolves.toEqual(
      restoredNewSession,
    );

    oldRestore.resolve(oldSession);

    await expect(oldRestorePromise).resolves.toBeNull();
    expect(ports.api.restore).toHaveBeenCalledWith(newPendingSession);
    expect(ports.storage.clearSession).not.toHaveBeenCalled();
    expect(getAuthSessionSnapshot()).toEqual(restoredNewSession);
  });

  it('does not clear a newer pending session when an older restore fails', async () => {
    const oldSession = buildSessionSnapshot({
      accessToken: 'old-staff-access-token',
      refreshToken: 'old-staff-refresh-token',
    });
    const newPendingSession = buildPendingSession();
    const deferredRestore = createDeferred<AuthSessionSnapshot>();
    const ports: AuthPorts = {
      api: {
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(),
        restore: vi.fn(() => deferredRestore.promise),
      },
      storage: {
        clearSession: vi.fn(),
        readSession: vi.fn(() => oldSession),
        writeSession: vi.fn(),
      },
    };

    const restorePromise = restoreSession(ports);

    await vi.waitFor(() => {
      expect(ports.api.restore).toHaveBeenCalledWith(oldSession);
    });

    setHydratingSession(newPendingSession);
    deferredRestore.reject(new Error('old restore failed'));

    await expect(restorePromise).resolves.toBeNull();
    expect(ports.storage.clearSession).not.toHaveBeenCalled();
    expect(ports.storage.writeSession).not.toHaveBeenCalled();
    expect(getCurrentAuthSession()).toEqual(newPendingSession);
  });
});

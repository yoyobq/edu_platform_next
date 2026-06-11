import { afterEach, describe, expect, it, vi } from 'vitest';

import { GraphQLIngressError } from '@/shared/graphql';

import { ensureFreshSession } from './ensure-fresh-session';
import type { AuthPorts } from './ports';
import { refreshSession } from './refresh-session';
import {
  getAuthSessionSnapshot,
  setAuthenticatedSession,
  setHydratingSession,
  setUnauthenticatedSession,
} from './session-store';
import type { AuthPendingSession, AuthSessionSnapshot } from './types';

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
      signature: null,
      tags: [],
    },
    ...overrides,
  };
}

function buildPendingSession(overrides: Partial<AuthPendingSession> = {}): AuthPendingSession {
  return {
    accessToken: 'pending-access-token',
    kind: 'PENDING',
    refreshToken: 'pending-refresh-token',
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
    const pendingSession = buildPendingSession({
      accessToken: 'refreshed-pending-access-token',
      refreshToken: 'refreshed-pending-refresh-token',
    });
    const refreshedSession = buildSessionSnapshot({
      accessToken: 'refreshed-access-token',
      refreshToken: 'refreshed-refresh-token',
    });
    const deferredRefresh = createDeferred<AuthPendingSession>();
    const storage = {
      clearSession: vi.fn(),
      readSession: vi.fn(() => currentSession),
      writeSession: vi.fn(),
    };
    const ports: AuthPorts = {
      api: {
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(() => deferredRefresh.promise),
        restore: vi.fn(async () => refreshedSession),
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

    deferredRefresh.resolve(pendingSession);

    await expect(directRefreshPromise).resolves.toEqual(refreshedSession);
    await expect(forcedRefreshPromise).resolves.toEqual(refreshedSession);
    expect(ports.api.restore).toHaveBeenCalledTimes(1);
    expect(ports.api.restore).toHaveBeenCalledWith(pendingSession);
    expect(storage.writeSession).toHaveBeenCalledTimes(2);
    expect(storage.writeSession).toHaveBeenNthCalledWith(1, pendingSession);
    expect(storage.writeSession).toHaveBeenNthCalledWith(2, refreshedSession);
  });

  it('persists rotated refresh tokens before hydrating the session snapshot', async () => {
    const currentSession = buildSessionSnapshot();
    const pendingSession = buildPendingSession({
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
    });
    const refreshedSession = buildSessionSnapshot({
      accessToken: 'hydrated-access-token',
      refreshToken: 'rotated-refresh-token',
    });
    const deferredHydrate = createDeferred<AuthSessionSnapshot>();
    const storage = {
      clearSession: vi.fn(),
      readSession: vi.fn(() => currentSession),
      writeSession: vi.fn(),
    };
    const ports: AuthPorts = {
      api: {
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(async () => pendingSession),
        restore: vi.fn(() => deferredHydrate.promise),
      },
      storage,
    };

    setAuthenticatedSession(currentSession);

    const refreshPromise = refreshSession(ports);

    await vi.waitFor(() => {
      expect(storage.writeSession).toHaveBeenCalledWith(pendingSession);
    });
    expect(ports.api.restore).toHaveBeenCalledWith(pendingSession);

    deferredHydrate.resolve(refreshedSession);

    await expect(refreshPromise).resolves.toEqual(refreshedSession);
    expect(storage.writeSession).toHaveBeenLastCalledWith(refreshedSession);
  });

  it('keeps refreshed tokens with the current snapshot when hydrate after refresh is transient', async () => {
    const currentSession = buildSessionSnapshot({
      accessToken: 'current-access-token',
      refreshToken: 'current-refresh-token',
    });
    const pendingSession = buildPendingSession({
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
    });
    const retainedSession = {
      ...currentSession,
      accessToken: pendingSession.accessToken,
      refreshToken: pendingSession.refreshToken,
    };
    let storedSession: AuthPendingSession | AuthSessionSnapshot | null = currentSession;
    const storage = {
      clearSession: vi.fn(() => {
        storedSession = null;
      }),
      readSession: vi.fn(() => storedSession),
      writeSession: vi.fn((session) => {
        storedSession = session;
      }),
    };
    const ports: AuthPorts = {
      api: {
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(async () => pendingSession),
        restore: vi.fn(async () => {
          throw new GraphQLIngressError({
            message: 'Service unavailable',
            type: 'http',
          });
        }),
      },
      storage,
    };

    setAuthenticatedSession(currentSession);

    await expect(refreshSession(ports)).resolves.toEqual(retainedSession);

    expect(storage.writeSession).toHaveBeenNthCalledWith(1, pendingSession);
    expect(storage.writeSession).toHaveBeenNthCalledWith(2, retainedSession);
    expect(storage.clearSession).not.toHaveBeenCalled();
    expect(getAuthSessionSnapshot()).toEqual(retainedSession);
  });

  it('clears refreshed pending tokens when hydrate after refresh fails with auth', async () => {
    const currentSession = buildSessionSnapshot({
      accessToken: 'current-access-token',
      refreshToken: 'current-refresh-token',
    });
    const pendingSession = buildPendingSession({
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
    });
    let storedSession: AuthPendingSession | AuthSessionSnapshot | null = currentSession;
    const storage = {
      clearSession: vi.fn(() => {
        storedSession = null;
      }),
      readSession: vi.fn(() => storedSession),
      writeSession: vi.fn((session) => {
        storedSession = session;
      }),
    };
    const ports: AuthPorts = {
      api: {
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(async () => pendingSession),
        restore: vi.fn(async () => {
          throw new GraphQLIngressError({
            message: 'Refreshed token rejected',
            type: 'auth',
          });
        }),
      },
      storage,
    };

    setAuthenticatedSession(currentSession);

    await expect(refreshSession(ports)).rejects.toMatchObject({
      type: 'auth',
    });

    expect(storage.writeSession).toHaveBeenCalledWith(pendingSession);
    expect(storage.clearSession).toHaveBeenCalledTimes(1);
    expect(getAuthSessionSnapshot()).toBeNull();
  });

  it('refreshes the pending hydrating session instead of returning the previous snapshot', async () => {
    const currentSession = buildSessionSnapshot({
      accessToken: 'staff-access-token',
      refreshToken: 'staff-refresh-token',
    });
    const pendingSession = buildPendingSession({
      accessToken: 'student-access-token',
      refreshToken: 'student-refresh-token',
    });
    const refreshedSession = buildSessionSnapshot({
      accessToken: 'student-refreshed-access-token',
      accountId: 1002,
      displayName: 'student-user',
      identity: {
        currentClassCode: 'CLASS-01',
        currentClassId: 'class-01',
        id: 'STU-001',
        kind: 'STUDENT',
        name: 'student-user',
        slotGroup: [],
        upstreamId: 'UP-001',
      },
      primaryAccessGroup: 'STUDENT',
      refreshToken: 'student-refreshed-refresh-token',
      slotGroup: [],
      userInfo: {
        accessGroup: ['STUDENT'],
        avatarUrl: null,
        email: 'student@example.com',
        nickname: 'student-user',
        signature: null,
        tags: [],
      },
    });
    const storage = {
      clearSession: vi.fn(),
      readSession: vi.fn(() => pendingSession),
      writeSession: vi.fn(),
    };
    const ports: AuthPorts = {
      api: {
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(async () => pendingSession),
        restore: vi.fn(async () => refreshedSession),
      },
      storage,
    };

    setAuthenticatedSession(currentSession);
    setHydratingSession(pendingSession);

    await expect(ensureFreshSession(ports)).resolves.toEqual(refreshedSession);
    expect(ports.api.refresh).toHaveBeenCalledWith({
      refreshToken: pendingSession.refreshToken,
    });
    expect(ports.api.restore).toHaveBeenCalledWith(pendingSession);
    expect(storage.writeSession).toHaveBeenNthCalledWith(1, pendingSession);
    expect(storage.writeSession).toHaveBeenNthCalledWith(2, refreshedSession);
    expect(getAuthSessionSnapshot()).toEqual(refreshedSession);
  });

  it('does not let an older in-flight refresh overwrite a newer pending session', async () => {
    const staffSession = buildSessionSnapshot({
      accessToken: 'staff-access-token',
      refreshToken: 'staff-refresh-token',
    });
    const staffRefreshedSession = buildSessionSnapshot({
      accessToken: 'staff-refreshed-access-token',
      refreshToken: 'staff-refreshed-refresh-token',
    });
    const studentPendingSession = buildPendingSession({
      accessToken: 'student-pending-access-token',
      refreshToken: 'student-pending-refresh-token',
    });
    const studentRefreshedSession = buildSessionSnapshot({
      accessToken: 'student-refreshed-access-token',
      accountId: 1002,
      displayName: 'student-user',
      identity: {
        currentClassCode: 'CLASS-01',
        currentClassId: 'class-01',
        id: 'STU-001',
        kind: 'STUDENT',
        name: 'student-user',
        slotGroup: [],
        upstreamId: 'UP-001',
      },
      primaryAccessGroup: 'STUDENT',
      refreshToken: 'student-refreshed-refresh-token',
      slotGroup: [],
      userInfo: {
        accessGroup: ['STUDENT'],
        avatarUrl: null,
        email: 'student@example.com',
        nickname: 'student-user',
        signature: null,
        tags: [],
      },
    });
    const staffPendingSession = buildPendingSession({
      accessToken: 'staff-pending-access-token',
      refreshToken: 'staff-pending-refresh-token',
    });
    const studentRotatedPendingSession = buildPendingSession({
      accessToken: 'student-rotated-pending-access-token',
      refreshToken: 'student-rotated-pending-refresh-token',
    });
    const staffRefresh = createDeferred<AuthPendingSession>();
    const studentRefresh = createDeferred<AuthPendingSession>();
    const staffHydrate = createDeferred<AuthSessionSnapshot>();
    const studentHydrate = createDeferred<AuthSessionSnapshot>();
    const storage = {
      clearSession: vi.fn(),
      readSession: vi.fn(() => studentPendingSession),
      writeSession: vi.fn(),
    };
    const ports: AuthPorts = {
      api: {
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(({ refreshToken }) => {
          if (refreshToken === staffSession.refreshToken) {
            return staffRefresh.promise;
          }

          if (refreshToken === studentPendingSession.refreshToken) {
            return studentRefresh.promise;
          }

          throw new Error(`Unexpected refresh token: ${refreshToken}`);
        }),
        restore: vi.fn((session) => {
          if (session.refreshToken === staffPendingSession.refreshToken) {
            return staffHydrate.promise;
          }

          if (session.refreshToken === studentRotatedPendingSession.refreshToken) {
            return studentHydrate.promise;
          }

          throw new Error(`Unexpected hydrate token: ${session.refreshToken}`);
        }),
      },
      storage,
    };

    setAuthenticatedSession(staffSession);
    const staffRefreshPromise = refreshSession(ports);

    setHydratingSession(studentPendingSession);
    const studentRefreshPromise = ensureFreshSession(ports, { force: true });

    expect(ports.api.refresh).toHaveBeenCalledTimes(2);
    expect(ports.api.refresh).toHaveBeenNthCalledWith(1, {
      refreshToken: staffSession.refreshToken,
    });
    expect(ports.api.refresh).toHaveBeenNthCalledWith(2, {
      refreshToken: studentPendingSession.refreshToken,
    });

    studentRefresh.resolve(studentRotatedPendingSession);
    studentHydrate.resolve(studentRefreshedSession);
    await expect(studentRefreshPromise).resolves.toEqual(studentRefreshedSession);

    staffRefresh.resolve(staffPendingSession);
    staffHydrate.resolve(staffRefreshedSession);
    await expect(staffRefreshPromise).resolves.toEqual(staffRefreshedSession);

    expect(storage.writeSession).toHaveBeenCalledTimes(2);
    expect(storage.writeSession).toHaveBeenNthCalledWith(1, studentRotatedPendingSession);
    expect(storage.writeSession).toHaveBeenNthCalledWith(2, studentRefreshedSession);
    expect(getAuthSessionSnapshot()).toEqual(studentRefreshedSession);
  });
});

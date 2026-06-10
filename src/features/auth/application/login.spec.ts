// src/features/auth/application/login.spec.ts

import { afterEach, describe, expect, it, vi } from 'vitest';

import { login } from './login';
import type { AuthPorts } from './ports';
import { restoreSession } from './restore-session';
import {
  getAuthSessionSnapshot,
  getAuthSessionState,
  setUnauthenticatedSession,
} from './session-store';
import type {
  AuthLoginInput,
  AuthPendingSession,
  AuthSessionSnapshot,
  AuthStoredSession,
} from './types';

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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, reject, resolve };
}

describe('login session hydration', () => {
  afterEach(() => {
    setUnauthenticatedSession();
  });

  it('hydrates the new login session while an older restore is still in flight', async () => {
    const oldSession = buildSessionSnapshot({
      accessToken: 'old-staff-access-token',
      refreshToken: 'old-staff-refresh-token',
    });
    const pendingLoginSession = buildPendingSession({
      accessToken: 'new-student-access-token',
      refreshToken: 'new-student-refresh-token',
    });
    const restoredLoginSession = buildSessionSnapshot({
      accessToken: pendingLoginSession.accessToken,
      refreshToken: pendingLoginSession.refreshToken,
    });
    const oldRestore = createDeferred<AuthSessionSnapshot>();
    const input: AuthLoginInput = {
      audience: 'DESKTOP',
      loginName: 'student-user',
      loginPassword: 'password',
      type: 'PASSWORD',
    };
    let storedSession: AuthStoredSession = oldSession;
    const ports: AuthPorts = {
      api: {
        login: vi.fn(async () => pendingLoginSession),
        refresh: vi.fn(),
        restore: vi.fn((session) => {
          if (session.accessToken === oldSession.accessToken) {
            return oldRestore.promise;
          }

          if (session.accessToken === pendingLoginSession.accessToken) {
            return Promise.resolve(restoredLoginSession);
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

    await expect(login(ports, input)).resolves.toEqual(pendingLoginSession);

    await vi.waitFor(() => {
      expect(getAuthSessionState().status).toBe('authenticated');
      expect(getAuthSessionSnapshot()).toEqual(restoredLoginSession);
    });

    oldRestore.resolve(oldSession);

    await expect(oldRestorePromise).resolves.toBeNull();
    expect(ports.api.login).toHaveBeenCalledWith(input);
    expect(ports.api.restore).toHaveBeenCalledWith(pendingLoginSession);
    expect(ports.storage.clearSession).not.toHaveBeenCalled();
    expect(getAuthSessionSnapshot()).toEqual(restoredLoginSession);
  });
});

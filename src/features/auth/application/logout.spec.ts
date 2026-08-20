// src/features/auth/application/logout.spec.ts

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearLocalAuthSession,
  logout,
  revokeAuthSession,
  revokeAuthSessionBestEffort,
} from './logout';
import type { AuthPorts } from './ports';
import {
  getAuthSessionState,
  getCurrentAuthSession,
  setAuthenticatedSession,
  setUnauthenticatedSession,
} from './session-store';
import type { AuthSessionSnapshot, AuthStoredSession } from './types';

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
  logout?: AuthPorts['api']['logout'];
  storedSession?: AuthStoredSession | null;
}): AuthPorts {
  return {
    api: {
      login: vi.fn(),
      logout: input.logout ?? vi.fn(async () => undefined),
      refresh: vi.fn(),
      restore: vi.fn(),
    },
    storage: {
      clearSession: vi.fn(),
      readSession: vi.fn(() => input.storedSession ?? null),
      writeSession: vi.fn(),
    },
  };
}

describe('auth logout', () => {
  afterEach(() => {
    vi.useRealTimers();
    setUnauthenticatedSession();
  });

  it('calls backend logout with the current access token before clearing local session', async () => {
    const session = buildSessionSnapshot();
    const apiLogout = vi.fn(async () => undefined);
    const ports = createPorts({ logout: apiLogout });

    setAuthenticatedSession(session);

    await expect(logout(ports)).resolves.toBeUndefined();

    expect(apiLogout).toHaveBeenCalledWith({ accessToken: session.accessToken });
    expect(ports.storage.clearSession).toHaveBeenCalledTimes(1);
    expect(getCurrentAuthSession()).toBeNull();
    expect(getAuthSessionState().status).toBe('unauthenticated');
  });

  it('revokes remote session without clearing local session', async () => {
    const session = buildSessionSnapshot();
    const apiLogout = vi.fn(async () => undefined);
    const ports = createPorts({ logout: apiLogout });

    setAuthenticatedSession(session);

    await expect(revokeAuthSession(ports, session)).resolves.toBeUndefined();

    expect(apiLogout).toHaveBeenCalledWith({ accessToken: session.accessToken });
    expect(ports.storage.clearSession).not.toHaveBeenCalled();
    expect(getCurrentAuthSession()).toEqual(session);
    expect(getAuthSessionState().status).toBe('authenticated');
  });

  it('throws remote revoke failures without clearing local session', async () => {
    const session = buildSessionSnapshot();
    const ports = createPorts({
      logout: vi.fn(async () => {
        throw new Error('logout failed');
      }),
    });

    setAuthenticatedSession(session);

    await expect(revokeAuthSession(ports, session)).rejects.toThrow('logout failed');

    expect(ports.api.logout).toHaveBeenCalledWith({ accessToken: session.accessToken });
    expect(ports.storage.clearSession).not.toHaveBeenCalled();
    expect(getCurrentAuthSession()).toEqual(session);
    expect(getAuthSessionState().status).toBe('authenticated');
  });

  it('bounds best-effort remote revoke without clearing local session', async () => {
    vi.useFakeTimers();

    const session = buildSessionSnapshot();
    const ports = createPorts({
      logout: vi.fn(() => new Promise<void>(() => undefined)),
    });

    setAuthenticatedSession(session);

    const revokePromise = revokeAuthSessionBestEffort(ports, session);

    await vi.advanceTimersByTimeAsync(1500);
    await expect(revokePromise).resolves.toBeUndefined();

    expect(ports.api.logout).toHaveBeenCalledWith({ accessToken: session.accessToken });
    expect(ports.storage.clearSession).not.toHaveBeenCalled();
    expect(getCurrentAuthSession()).toEqual(session);
    expect(getAuthSessionState().status).toBe('authenticated');
  });

  it('still clears local session when backend logout fails', async () => {
    const session = buildSessionSnapshot();
    const ports = createPorts({
      logout: vi.fn(async () => {
        throw new Error('logout failed');
      }),
    });

    setAuthenticatedSession(session);

    await expect(logout(ports)).resolves.toBeUndefined();

    expect(ports.api.logout).toHaveBeenCalledWith({ accessToken: session.accessToken });
    expect(ports.storage.clearSession).toHaveBeenCalledTimes(1);
    expect(getCurrentAuthSession()).toBeNull();
  });

  it('does not wait forever when backend logout does not settle', async () => {
    vi.useFakeTimers();

    const session = buildSessionSnapshot();
    const ports = createPorts({
      logout: vi.fn(() => new Promise<void>(() => undefined)),
    });

    setAuthenticatedSession(session);

    const logoutPromise = logout(ports);

    await vi.advanceTimersByTimeAsync(1500);
    await expect(logoutPromise).resolves.toBeUndefined();

    expect(ports.api.logout).toHaveBeenCalledWith({ accessToken: session.accessToken });
    expect(ports.storage.clearSession).toHaveBeenCalledTimes(1);
    expect(getCurrentAuthSession()).toBeNull();
  });

  it('keeps local-only cleanup local', () => {
    const session = buildSessionSnapshot();
    const ports = createPorts({});

    setAuthenticatedSession(session);
    clearLocalAuthSession(ports);

    expect(ports.api.logout).not.toHaveBeenCalled();
    expect(ports.storage.clearSession).toHaveBeenCalledTimes(1);
    expect(getCurrentAuthSession()).toBeNull();
  });
});

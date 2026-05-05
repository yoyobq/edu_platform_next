import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthPorts } from './ports';
import { restoreSession } from './restore-session';
import { setUnauthenticatedSession } from './session-store';
import type { AuthPendingSession, AuthSessionSnapshot } from './types';

function buildPendingSession(): AuthPendingSession {
  return {
    accessToken: 'pending-access-token',
    kind: 'PENDING',
    refreshToken: 'pending-refresh-token',
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
      accountId: 9527,
      createdAt: '2026-01-01T00:00:00.000Z',
      departmentId: null,
      employmentStatus: 'ACTIVE',
      id: '3664',
      jobTitle: null,
      kind: 'STAFF',
      name: 'staff-user',
      remark: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
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
  storedSession: AuthPendingSession;
}): AuthPorts {
  return {
    api: {
      login: vi.fn(),
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
});

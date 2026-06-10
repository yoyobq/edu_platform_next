// src/features/auth/application/session-store.spec.ts

import { afterEach, describe, expect, it } from 'vitest';

import {
  getAuthSessionSnapshot,
  getCurrentAuthSession,
  setAuthenticatedSession,
  setHydratingSession,
  setUnauthenticatedSession,
} from './session-store';
import type { AuthPendingSession, AuthSessionSnapshot } from './types';

function buildPendingSession(): AuthPendingSession {
  return {
    accessToken: 'student-pending-access-token',
    kind: 'PENDING',
    refreshToken: 'student-pending-refresh-token',
  };
}

function buildSessionSnapshot(): AuthSessionSnapshot {
  return {
    accessToken: 'staff-access-token',
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
    refreshToken: 'staff-refresh-token',
    slotGroup: [],
    userInfo: {
      accessGroup: ['STAFF'],
      avatarUrl: null,
      email: 'staff@example.com',
      nickname: 'staff-user',
      signature: null,
      tags: [],
    },
  };
}

describe('auth session store', () => {
  afterEach(() => {
    setUnauthenticatedSession();
  });

  it('uses the pending session as current while hydrating a new login', () => {
    const previousSnapshot = buildSessionSnapshot();
    const pendingSession = buildPendingSession();

    setAuthenticatedSession(previousSnapshot);
    setHydratingSession(pendingSession);

    expect(getCurrentAuthSession()).toEqual(pendingSession);
    expect(getAuthSessionSnapshot()).toBeNull();
  });
});
